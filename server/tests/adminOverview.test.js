import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Capture the customer messages instead of needing Redis.
const queued = [];
vi.mock("../queues/index.js", () => ({
  emailQueue: { name: "email" },
  whatsappQueue: { name: "whatsapp" },
  addToQueue: async (queue, jobName, data) => { queued.push({ queue: queue.name, jobName, to: data.to || data.phone }); return null; },
}));

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: Product } = await import("../models/Product.js");
const { default: Order } = await import("../models/Order.js");
const { buildOverview, lagosDay } = await import("../services/adminOverview.js");

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
  queued.length = 0;
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
});

async function register(email, isAdmin = false) {
  const res = await request(app).post("/api/auth/register").send({ name: "Someone", email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return { headers: { Authorization: `Bearer ${res.body.token}` }, id: res.body._id };
}

const item = { name: "Shea Body Butter", quantity: 1, image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/s.jpg", price: 7500 };
const address = { fullName: "Ada Buyer", phone: "08030000000", address: "1 St", city: "Umuahia", state: "Abia" };
const makeOrder = (userId, o = {}) => Order.create({
  user: userId,
  orderItems: [{ ...item, product: new mongoose.Types.ObjectId() }],
  deliveryAddress: address,
  itemsPrice: 7500, deliveryPrice: 2500, totalPrice: 10000,
  ...o,
});

const DAY = 864e5;
const NOW = new Date("2026-11-22T10:00:00Z"); // 11am in Lagos

describe("buildOverview", () => {
  it("counts paid, non-cancelled revenue by Lagos day and compares 7-day periods", async () => {
    const buyer = await User.create({ name: "B", email: "b@example.com", password: "password123", createdAt: new Date(NOW - 2 * DAY) });
    await User.create({ name: "Admin", email: "a@example.com", password: "password123", isAdmin: true });
    await Product.create({ name: "P", description: "x", price: 1, image: item.image, category: "skincare", stock: 2 });

    await makeOrder(buyer._id, { isPaid: true, status: "paid", paidAt: new Date(NOW - 1 * DAY), totalPrice: 10000 });
    await makeOrder(buyer._id, { isPaid: true, status: "delivered", paidAt: new Date(NOW - 9 * DAY), totalPrice: 20000 });
    await makeOrder(buyer._id, { isPaid: true, status: "cancelled", paidAt: new Date(NOW - 1 * DAY), totalPrice: 99000 }); // refunded
    await makeOrder(buyer._id, { status: "pending" }); // unpaid
    // 23:30 UTC on 21 Nov is already 22 Nov in Lagos.
    await makeOrder(buyer._id, { isPaid: true, status: "processing", paidAt: new Date("2026-11-21T23:30:00Z"), totalPrice: 5000 });

    const o = await buildOverview(NOW);
    expect(o.totals).toEqual({ revenue: 35000, paidOrders: 3, averageOrderValue: 11667, customers: 1, products: 1 });
    expect(o.last7).toEqual({ revenue: 15000, paidOrders: 2, newCustomers: 1 });
    expect(o.prev7).toEqual({ revenue: 20000, paidOrders: 1, newCustomers: 0 });
    expect(o.daily).toHaveLength(30);
    expect(o.daily.at(-1)).toEqual({ date: "2026-11-22", revenue: 5000, paidOrders: 1, newCustomers: 0 });
    expect(o.statusCounts).toEqual({ pending: 1, paid: 1, processing: 1, shipped: 0, delivered: 1, cancelled: 1 });
    expect(o.lowStock.map((p) => p.name)).toEqual(["P"]);
    expect(o.recentOrders).toHaveLength(5);
  });

  it("returns zeros, not invented trends, for an empty store", async () => {
    const o = await buildOverview(NOW);
    expect(o.totals.revenue).toBe(0);
    expect(o.totals.averageOrderValue).toBe(0);
    expect(o.prev7).toEqual({ revenue: 0, paidOrders: 0, newCustomers: 0 });
    expect(o.daily.every((d) => d.revenue === 0)).toBe(true);
  });

  it("uses Lagos dates", () => {
    expect(lagosDay(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-22");
    expect(lagosDay(new Date("2026-11-21T22:59:00Z"))).toBe("2026-11-21");
  });
});

describe("GET /api/admin/overview", () => {
  it("is admin-only", async () => {
    const customer = await register("c@example.com");
    expect((await request(app).get("/api/admin/overview")).status).toBe(401);
    expect((await request(app).get("/api/admin/overview").set(customer.headers)).status).toBe(401);
    const admin = await register("admin@example.com", true);
    const res = await request(app).get("/api/admin/overview").set(admin.headers);
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("Africa/Lagos");
  });
});

describe("PUT /api/admin/orders/status (bulk)", () => {
  it("ships several paid orders, tells each customer, and skips ones that can't move", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await register("buyer@example.com");
    const a = await makeOrder(buyer.id, { isPaid: true, status: "processing" });
    const b = await makeOrder(buyer.id, { isPaid: true, status: "processing" });
    const unpaid = await makeOrder(buyer.id, { status: "pending" });

    const res = await request(app).put("/api/admin/orders/status").set(admin.headers)
      .send({ ids: [String(a._id), String(b._id), String(unpaid._id)], status: "shipped" });
    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([String(a._id), String(b._id)]);
    expect(res.body.failed).toEqual([{ id: String(unpaid._id), message: 'Cannot change order from "pending" to "shipped"' }]);
    expect((await Order.findById(a._id)).status).toBe("shipped");
    expect((await Order.findById(unpaid._id)).status).toBe("pending");
    // Same messages as a single update: an email and a WhatsApp per shipped order.
    expect(queued.filter((q) => q.jobName === "order-shipped" && q.queue === "email").map((q) => q.to)).toEqual(["buyer@example.com", "buyer@example.com"]);
    expect(queued.filter((q) => q.jobName === "order-shipped" && q.queue === "whatsapp")).toHaveLength(2);
  });

  it("won't cancel in bulk, and checks ids and access", async () => {
    const admin = await register("admin@example.com", true);
    const customer = await register("c@example.com");
    const order = await makeOrder(customer.id, { isPaid: true, status: "paid" });
    const body = { ids: [String(order._id)], status: "cancelled" };
    expect((await request(app).put("/api/admin/orders/status").set(admin.headers).send(body)).status).toBe(400);
    expect((await request(app).put("/api/admin/orders/status").set(admin.headers).send({ ids: ["nope"], status: "shipped" })).status).toBe(400);
    expect((await request(app).put("/api/admin/orders/status").set(admin.headers).send({ ids: [], status: "shipped" })).status).toBe(400);
    expect((await request(app).put("/api/admin/orders/status").set(customer.headers).send({ ...body, status: "processing" })).status).toBe(401);
    expect((await Order.findById(order._id)).status).toBe("paid");
  });

  it("reports a missing order without failing the rest", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await register("buyer@example.com");
    const ok = await makeOrder(buyer.id, { isPaid: true, status: "paid" });
    const ghost = String(new mongoose.Types.ObjectId());
    const res = await request(app).put("/api/admin/orders/status").set(admin.headers).send({ ids: [ghost, String(ok._id)], status: "processing" });
    expect(res.body).toEqual({ updated: [String(ok._id)], failed: [{ id: ghost, message: "Order not found" }] });
  });
});
