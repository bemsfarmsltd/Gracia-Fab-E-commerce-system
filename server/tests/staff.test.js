import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Capture emails (invite links) instead of sending them.
const sent = [];
vi.mock("../services/emailService.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, sendEmail: vi.fn(async (msg) => { sent.push(msg); }) };
});

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: Product } = await import("../models/Product.js");
const { default: Order } = await import("../models/Order.js");
const { default: AdminActivity } = await import("../models/AdminActivity.js");
const { default: generateToken } = await import("../utils/generateToken.js");
const { STAFF_PERMISSIONS } = await import("../config/permissions.js");

let mongod;
beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  sent.length = 0;
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), AdminActivity.deleteMany({})]);
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (u) => generateToken(u._id, { isAdmin: u.isAdmin || u.role === "staff" });
const inviteToken = () => sent.at(-1)?.html.match(/set-password\?token=([0-9a-f]{64})/)?.[1];

async function owner() {
  return User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
}

// Sign in through the real login (the test env returns the token directly
// when email delivery isn't set up, or via the OTP step).
async function signIn(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.body.token) return res.body;
  const user = await User.findOne({ email });
  const code = res.body.devOtpCode;
  expect(code, "login needs the dev OTP code in tests").toBeTruthy();
  return (await request(app).post("/api/auth/verify-otp").send({ email: user.email, code })).body;
}

describe("adding staff", () => {
  it("invites a new person: they set a password, sign in, and get staff permissions and an 8-hour session", async () => {
    const md = await owner();
    const res = await request(app).post("/api/admin/staff").set(bearer(tokenFor(md))).send({ name: "Chioma", email: "Chioma@Example.com" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Chioma", email: "chioma@example.com", role: "staff", invitePending: true });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("chioma@example.com");
    const token = inviteToken();
    expect(token).toBeTruthy();
    // Only a hash of the link's code is stored.
    const saved = await User.findOne({ email: "chioma@example.com" });
    expect(saved.inviteTokenHash).not.toBe(token);

    // Can't sign in before choosing a password.
    expect((await request(app).post("/api/auth/login").send({ email: "chioma@example.com", password: "anything1" })).status).toBe(401);

    const set = await request(app).post("/api/auth/set-password").send({ token, password: "newpass123" });
    expect(set.status).toBe(200);
    // The link works once.
    expect((await request(app).post("/api/auth/set-password").send({ token, password: "other1234" })).status).toBe(400);

    const session = await signIn("chioma@example.com", "newpass123");
    expect(session).toMatchObject({ role: "staff", isAdmin: false });
    expect(session.permissions).toEqual(STAFF_PERMISSIONS);
    const { exp, at } = jwt.decode(session.token);
    expect(exp - at).toBeLessThanOrEqual(8 * 3600 + 1);
  });

  it("gives an existing customer account staff access without touching their password", async () => {
    const md = await owner();
    await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const res = await request(app).post("/api/admin/staff").set(bearer(tokenFor(md))).send({ name: "Ada", email: "ada@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.invitePending).toBe(false);
    expect(sent[0].subject).toMatch(/now have access/);
    const session = await signIn("ada@example.com", "password123");
    expect(session.role).toBe("staff");
  });

  it("refuses duplicates and owners, expired links, and staff adding staff", async () => {
    const md = await owner();
    const t = tokenFor(md);
    expect((await request(app).post("/api/admin/staff").set(bearer(t)).send({ name: "MD", email: "md@example.com" })).status).toBe(400);
    await request(app).post("/api/admin/staff").set(bearer(t)).send({ name: "Chioma", email: "chioma@example.com" }).expect(201);
    expect((await request(app).post("/api/admin/staff").set(bearer(t)).send({ name: "Chioma", email: "chioma@example.com" })).status).toBe(400);

    const token = inviteToken();
    await User.updateOne({ email: "chioma@example.com" }, { inviteExpiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post("/api/auth/set-password").send({ token, password: "newpass123" })).status).toBe(400);

    const staff = await User.findOne({ email: "chioma@example.com" });
    const res = await request(app).post("/api/admin/staff").set(bearer(tokenFor(staff))).send({ name: "X", email: "x@example.com" });
    expect(res.status).toBe(403);
  });
});

describe("what staff can and can't do", () => {
  async function setup() {
    const buyer = await User.create({ name: "Buyer", email: "buyer@example.com", password: "password123" });
    const staff = await User.create({ name: "Chioma", email: "chioma@example.com", password: "password123", role: "staff" });
    const product = await Product.create({ name: "Shea", description: "d", price: 7500, image: "/x", category: "skincare", stock: 5 });
    const order = await Order.create({
      user: buyer._id, orderItems: [{ product: product._id, name: "Shea", price: 7500, quantity: 1 }],
      itemsPrice: 7500, deliveryPrice: 2500, totalPrice: 10000, status: "paid", isPaid: true,
      statusHistory: [{ status: "pending" }, { status: "paid" }],
    });
    return { staff, product, order, t: tokenFor(staff) };
  }

  it("lets staff work orders, count stock, bookings, customers and messages", async () => {
    const { t, order, product } = await setup();
    expect((await request(app).get("/api/admin/orders").set(bearer(t))).status).toBe(200);
    expect((await request(app).put(`/api/admin/orders/${order._id}`).set(bearer(t)).send({ status: "processing" })).status).toBe(200);
    expect((await request(app).get("/api/admin/products").set(bearer(t))).status).toBe(200);
    expect((await request(app).put("/api/admin/products/stock").set(bearer(t)).send({ updates: [{ id: String(product._id), stock: 7 }] })).status).toBe(200);
    expect((await request(app).get("/api/admin/customers").set(bearer(t))).status).toBe(200);
    expect((await request(app).get("/api/admin/bookings").set(bearer(t))).status).toBe(200);
    expect((await request(app).get("/api/contact").set(bearer(t))).status).toBe(200);
  });

  it("keeps money, prices, cancellations, vouchers, staff and the activity log owner-only", async () => {
    const { t, order, product } = await setup();
    const forbidden = [
      ["get", "/api/admin/stats"],
      ["get", "/api/admin/overview"],
      ["get", "/api/admin/reports/sales"],
      ["get", "/api/admin/orders/export"],
      ["get", "/api/admin/users"],
      ["get", "/api/admin/vouchers"],
      ["get", "/api/admin/staff"],
      ["get", "/api/admin/activity"],
      ["get", "/api/contact/subscribers"],
    ];
    for (const [method, path] of forbidden) {
      const res = await request(app)[method](path).set(bearer(t));
      expect(res.status, path).toBe(403);
    }
    expect((await request(app).put(`/api/admin/products/${product._id}`).set(bearer(t)).send({ price: 1 })).status).toBe(403);
    expect((await request(app).delete(`/api/admin/products/${product._id}`).set(bearer(t))).status).toBe(403);
    expect((await request(app).put(`/api/admin/orders/${order._id}/cancel`).set(bearer(t)).send({ reason: "x" })).status).toBe(403);
    // …including cancelling through the general status route.
    expect((await request(app).put(`/api/admin/orders/${order._id}`).set(bearer(t)).send({ status: "cancelled" })).status).toBe(403);
    expect((await Order.findById(order._id)).status).toBe("paid");
    expect((await Product.findById(product._id)).price).toBe(7500);
  });

  it("records staff actions in the activity log under their name", async () => {
    const { t, order } = await setup();
    await request(app).put(`/api/admin/orders/${order._id}`).set(bearer(t)).send({ status: "processing" }).expect(200);
    let entry;
    for (let i = 0; i < 50 && !entry; i++) {
      entry = await AdminActivity.findOne({ action: "order.status" }).lean();
      if (!entry) await new Promise((r) => setTimeout(r, 20));
    }
    expect(entry).toMatchObject({ actorName: "Chioma", actorEmail: "chioma@example.com" });
  });

  it("ends access on the next request once the owner removes them", async () => {
    const md = await owner();
    const { staff, t } = await setup();
    expect((await request(app).get("/api/admin/orders").set(bearer(t))).status).toBe(200);
    await request(app).delete(`/api/admin/staff/${staff._id}`).set(bearer(tokenFor(md))).expect(200);
    expect((await request(app).get("/api/admin/orders").set(bearer(t))).status).toBe(401);
    // The account itself still exists, as a customer account.
    expect((await User.findById(staff._id)).role).toBe("customer");
  });

  it("lists owners and staff for the owner, never with passwords or invite codes", async () => {
    const md = await owner();
    await request(app).post("/api/admin/staff").set(bearer(tokenFor(md))).send({ name: "Chioma", email: "chioma@example.com" }).expect(201);
    const res = await request(app).get("/api/admin/staff").set(bearer(tokenFor(md)));
    expect(res.status).toBe(200);
    expect(res.body.people.map((p) => [p.name, p.role])).toEqual([["Gracia MD", "owner"], ["Chioma", "staff"]]);
    expect(JSON.stringify(res.body)).not.toMatch(/password|inviteTokenHash/);
    expect(res.body.staffPermissions.map((p) => p.key)).toEqual(STAFF_PERMISSIONS);
  });
});
