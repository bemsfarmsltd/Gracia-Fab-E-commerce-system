import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app, { allowedOrigins } from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
});

async function register(email, isAdmin = false) {
  const res = await request(app).post("/api/auth/register").send({ name: "Someone", email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return { Authorization: `Bearer ${res.body.token}` };
}

const newProduct = {
  name: "Shea Body Butter",
  description: "Rich whipped shea butter.",
  price: 7500,
  image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/shea.jpg",
  category: "skincare",
  brand: "Gracia Fab",
  stock: 12,
  tags: "body, shea , moisturiser",
};

const deliveryAddress = { fullName: "Ada Buyer", phone: "08030000000", address: "1 St", city: "Lagos", state: "Lagos" };

async function placeOrder(buyer, product, { paid = false } = {}) {
  const order = (await request(app).post("/api/orders").set(buyer).send({
    orderItems: [{ product: product._id, quantity: 1 }],
    deliveryAddress,
  })).body;
  if (paid) await Order.updateOne({ _id: order._id }, { isPaid: true, status: "paid" });
  return order;
}

describe("admin access", () => {
  it("refuses customers and logged-out visitors on every admin route", async () => {
    const customer = await register("customer@example.com");
    for (const path of ["/api/admin/stats", "/api/admin/orders", "/api/admin/products", "/api/admin/users"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set(customer)).status).toBe(401);
    }
    expect((await request(app).post("/api/admin/products").set(customer).send(newProduct)).status).toBe(401);
    expect(await Product.countDocuments()).toBe(0);
  });
});

describe("dashboard stats", () => {
  it("counts products, orders and users, and only paid orders as revenue", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await register("buyer@example.com");
    const product = await Product.create({ ...newProduct, tags: [] });
    const paid = await placeOrder(buyer, product, { paid: true });
    await placeOrder(buyer, product); // unpaid: not revenue

    const res = await request(app).get("/api/admin/stats").set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalProducts: 1, totalOrders: 2, totalUsers: 2, totalRevenue: paid.totalPrice });
    expect(res.body.recentOrders).toHaveLength(2);
    expect(res.body.recentOrders[0].user.email).toBe("buyer@example.com");
  });
});

describe("product management", () => {
  it("creates, lists, updates and deletes a product", async () => {
    const admin = await register("admin@example.com", true);

    const created = await request(app).post("/api/admin/products").set(admin).send(newProduct);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Shea Body Butter", price: 7500, stock: 12, isInStock: true });
    expect(created.body.tags).toEqual(["body", "shea", "moisturiser"]);

    const list = await request(app).get("/api/admin/products").set(admin);
    expect(list.body.map((p) => p.name)).toEqual(["Shea Body Butter"]);

    const id = created.body._id;
    const updated = await request(app).put(`/api/admin/products/${id}`).set(admin).send({ price: 8000, stock: 0 });
    expect(updated.status).toBe(200);
    // Only the fields sent change; stock 0 is a real value, not "missing".
    expect(updated.body).toMatchObject({ name: "Shea Body Butter", price: 8000, stock: 0, isInStock: false });

    const deleted = await request(app).delete(`/api/admin/products/${id}`).set(admin);
    expect(deleted.status).toBe(200);
    expect(await Product.countDocuments()).toBe(0);
    expect((await request(app).delete(`/api/admin/products/${id}`).set(admin)).status).toBe(404);
  });

  it("rejects invalid products", async () => {
    const admin = await register("admin@example.com", true);
    const res = await request(app).post("/api/admin/products").set(admin).send({ ...newProduct, price: -5, name: "" });
    expect(res.status).toBe(400);
    expect(await Product.countDocuments()).toBe(0);
    expect((await request(app).put(`/api/admin/products/${new mongoose.Types.ObjectId()}`).set(admin).send({ price: 1 })).status).toBe(404);
  });
});

describe("order status", () => {
  it("moves a paid order through processing, shipped and delivered", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await register("buyer@example.com");
    const product = await Product.create({ ...newProduct, tags: [] });
    const order = await placeOrder(buyer, product, { paid: true });

    for (const status of ["processing", "shipped", "delivered"]) {
      const res = await request(app).put(`/api/admin/orders/${order._id}`).set(admin).send({ status, note: `now ${status}` });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    const history = (await Order.findById(order._id)).statusHistory.map((h) => h.status);
    expect(history.slice(-3)).toEqual(["processing", "shipped", "delivered"]);

    const all = await request(app).get("/api/admin/orders").set(admin);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].user.email).toBe("buyer@example.com");
  });

  it("refuses skipping steps, e.g. shipping an unpaid order", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await register("buyer@example.com");
    const product = await Product.create({ ...newProduct, tags: [] });
    const order = await placeOrder(buyer, product);

    const res = await request(app).put(`/api/admin/orders/${order._id}`).set(admin).send({ status: "shipped" });
    expect(res.status).toBe(400);
    expect((await Order.findById(order._id)).status).toBe("pending");
    expect((await request(app).put(`/api/admin/orders/${order._id}`).set(admin).send({ status: "teleported" })).status).toBe(400);
  });
});

describe("user list", () => {
  it("lists users without passwords or login-code hashes", async () => {
    const admin = await register("admin@example.com", true);
    await register("buyer@example.com");
    await User.updateOne({ email: "buyer@example.com" }, { otpCodeHash: "secret-hash", otpExpiresAt: new Date(), otpAttempts: 2 });

    const res = await request(app).get("/api/admin/users").set(admin);

    expect(res.status).toBe(200);
    expect(res.body.map((u) => u.email).sort()).toEqual(["admin@example.com", "buyer@example.com"]);
    for (const user of res.body) {
      for (const field of ["password", "otpCodeHash", "otpExpiresAt", "otpAttempts"]) {
        expect(user).not.toHaveProperty(field);
      }
    }
  });
});

describe("CORS", () => {
  const original = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = original; });

  it("allows localhost only outside production", () => {
    process.env.NODE_ENV = "production";
    expect(allowedOrigins()).toContain("https://gracia-fab.vercel.app");
    expect(allowedOrigins().some((o) => o.includes("localhost"))).toBe(false);
    process.env.NODE_ENV = "development";
    expect(allowedOrigins()).toContain("http://localhost:5173");
  });

  it("answers the live site's preflight", async () => {
    const res = await request(app).options("/api/products").set("Origin", "https://gracia-fab.vercel.app").set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBe("https://gracia-fab.vercel.app");
  });
});
