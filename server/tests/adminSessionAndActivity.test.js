import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import AdminActivity from "../models/AdminActivity.js";
import generateToken, { ADMIN_SESSION_SECONDS, SESSION_DAYS } from "../utils/generateToken.js";

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), AdminActivity.deleteMany({})]);
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const now = () => Math.floor(Date.now() / 1000);

async function makeUser(email, isAdmin = false) {
  return User.create({ name: email.split("@")[0], email, password: "password123", isAdmin });
}

// The activity entry is written just after the response; wait for it.
async function waitForActivity(filter = {}, count = 1) {
  for (let i = 0; i < 50; i++) {
    const found = await AdminActivity.find(filter).sort({ createdAt: 1 }).lean();
    if (found.length >= count) return found;
    await new Promise((r) => setTimeout(r, 20));
  }
  return AdminActivity.find(filter).lean();
}

describe("8-hour admin sessions", () => {
  it("issues admin tokens that end 8 hours after sign-in, customers 7 days", () => {
    const adminToken = jwt.decode(generateToken("a".repeat(24), { isAdmin: true }));
    expect(adminToken.exp - adminToken.at).toBeGreaterThanOrEqual(ADMIN_SESSION_SECONDS - 1);
    expect(adminToken.exp - adminToken.at).toBeLessThanOrEqual(ADMIN_SESSION_SECONDS + 1);
    const customerToken = jwt.decode(generateToken("b".repeat(24)));
    expect(customerToken.exp - customerToken.iat).toBe(SESSION_DAYS * 24 * 60 * 60);
  });

  it("refuses admin pages once 8 hours have passed since signing in, even with an unexpired token", async () => {
    const admin = await makeUser("admin@example.com", true);
    // A 7-day token from 9 hours ago (e.g. issued before the account became an admin).
    const old = jwt.sign({ id: admin._id, at: now() - 9 * 3600 }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const res = await request(app).get("/api/admin/stats").set(bearer(old));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("admin-session-expired");

    const fresh = generateToken(admin._id, { isAdmin: true });
    expect((await request(app).get("/api/admin/stats").set(bearer(fresh))).status).toBe(200);
  });

  it("renewing doesn't extend an admin session past 8 hours", async () => {
    const admin = await makeUser("admin@example.com", true);
    const signedIn = now() - 5 * 3600;
    const token = generateToken(admin._id, { isAdmin: true, authTime: signedIn });
    const res = await request(app).post("/api/auth/refresh").set(bearer(token));
    expect(res.status).toBe(200);
    const renewed = jwt.decode(res.body.token);
    expect(renewed.at).toBe(signedIn);
    expect(renewed.exp).toBeLessThanOrEqual(signedIn + ADMIN_SESSION_SECONDS + 1);
  });

  it("leaves customers' 7-day sessions alone", async () => {
    const customer = await makeUser("ada@example.com");
    const old = jwt.sign({ id: customer._id, at: now() - 3 * 24 * 3600 }, process.env.JWT_SECRET, { expiresIn: "7d" });
    expect((await request(app).get("/api/orders/myorders").set(bearer(old))).status).toBe(200);
  });
});

describe("admin activity log", () => {
  it("records a price and stock change with who, what, before and after", async () => {
    const admin = await makeUser("md@example.com", true);
    const token = generateToken(admin._id, { isAdmin: true });
    const product = await Product.create({ name: "Shea Body Butter", description: "d", price: 7500, image: "/x.jpg", category: "skincare", stock: 12 });

    const res = await request(app).put(`/api/admin/products/${product._id}`).set(bearer(token)).send({ price: 8000, stock: 10 });
    expect(res.status).toBe(200);

    const [entry] = await waitForActivity({ action: "product.update" });
    expect(entry).toMatchObject({ actorEmail: "md@example.com", targetType: "product", targetId: String(product._id) });
    expect(entry.changes).toEqual({ price: { from: 7500, to: 8000 }, stock: { from: 12, to: 10 } });
    expect(entry.summary).toBe('"Shea Body Butter": price ₦7,500 → ₦8,000, stock 12 → 10');
  });

  it("records stock counts from the Inventory tab per product", async () => {
    const admin = await makeUser("md@example.com", true);
    const token = generateToken(admin._id, { isAdmin: true });
    const a = await Product.create({ name: "A", description: "d", price: 100, image: "/x", category: "skincare", stock: 0 });
    const b = await Product.create({ name: "B", description: "d", price: 100, image: "/x", category: "skincare", stock: 5 });

    await request(app).put("/api/admin/products/stock").set(bearer(token))
      .send({ updates: [{ id: String(a._id), stock: 8 }, { id: String(b._id), stock: 5 }] }).expect(200);

    const [entry] = await waitForActivity({ action: "stock.bulk_update" });
    // B didn't change, so only A is listed.
    expect(entry.changes.stock).toEqual([{ product: String(a._id), name: "A", from: 0, to: 8 }]);
    expect(entry.summary).toBe('Stock of "A" 0 → 8');
  });

  it("records order status moves", async () => {
    const admin = await makeUser("md@example.com", true);
    const buyer = await makeUser("ada@example.com");
    const token = generateToken(admin._id, { isAdmin: true });
    const order = await Order.create({
      user: buyer._id, orderItems: [{ product: new mongoose.Types.ObjectId(), name: "P", price: 100, quantity: 1 }],
      itemsPrice: 100, deliveryPrice: 2500, totalPrice: 2600, status: "paid", isPaid: true,
      statusHistory: [{ status: "pending" }, { status: "paid" }],
    });
    await request(app).put(`/api/admin/orders/${order._id}`).set(bearer(token)).send({ status: "processing" }).expect(200);
    const [entry] = await waitForActivity({ action: "order.status" });
    expect(entry.changes.status).toEqual({ from: "paid", to: "processing" });
    expect(entry.summary).toBe(`Order #${String(order._id).slice(-8).toUpperCase()}: paid → processing`);
  });

  it("doesn't log reads, refused changes or other people's requests", async () => {
    const admin = await makeUser("md@example.com", true);
    const customer = await makeUser("ada@example.com");
    const token = generateToken(admin._id, { isAdmin: true });
    await request(app).get("/api/admin/products").set(bearer(token)).expect(200);
    await request(app).post("/api/admin/products").set(bearer(token)).send({ name: "" }).expect(400);
    await request(app).post("/api/admin/products").set(bearer(generateToken(customer._id))).send({ name: "x" }).expect(401);
    await new Promise((r) => setTimeout(r, 150));
    expect(await AdminActivity.countDocuments()).toBe(0);
  });

  it("never copies passwords or image data into the log", async () => {
    const admin = await makeUser("md@example.com", true);
    const token = generateToken(admin._id, { isAdmin: true });
    await request(app).post("/api/admin/vouchers").set(bearer(token)).send({ code: "TEST10", type: "percent", value: 10 }).expect(201);
    const [entry] = await waitForActivity({ action: "voucher.create" });
    expect(entry.changes).toMatchObject({ code: "TEST10", type: "percent", value: 10 });
    expect(JSON.stringify(entry)).not.toMatch(/password|base64/i);
  });

  it("lists the log newest first for admins, filtered by area, and refuses customers", async () => {
    const admin = await makeUser("md@example.com", true);
    const customer = await makeUser("ada@example.com");
    const token = generateToken(admin._id, { isAdmin: true });
    await AdminActivity.create([
      { actor: admin._id, action: "product.update", summary: "first", createdAt: new Date(Date.now() - 2000) },
      { actor: admin._id, action: "order.status", summary: "second", createdAt: new Date(Date.now() - 1000) },
      { actor: admin._id, action: "product.delete", summary: "third" },
    ]);
    const all = await request(app).get("/api/admin/activity").set(bearer(token)).expect(200);
    expect(all.body.items.map((i) => i.summary)).toEqual(["third", "second", "first"]);
    expect(all.body.items[0]).not.toHaveProperty("ip");

    const products = await request(app).get("/api/admin/activity?action=product").set(bearer(token)).expect(200);
    expect(products.body.items.map((i) => i.summary)).toEqual(["third", "first"]);

    expect((await request(app).get("/api/admin/activity").set(bearer(generateToken(customer._id)))).status).toBe(401);
  });
});
