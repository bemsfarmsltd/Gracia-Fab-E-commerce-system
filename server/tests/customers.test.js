import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import CustomerNote from "../models/CustomerNote.js";

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
  await Promise.all([User.deleteMany({}), Order.deleteMany({}), CustomerNote.deleteMany({})]);
});

async function register(email, { isAdmin = false, name = "Someone" } = {}) {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return { headers: { Authorization: `Bearer ${res.body.token}` }, id: res.body._id };
}

const item = { name: "Shea Body Butter", quantity: 2, image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/s.jpg", price: 7500 };
const makeOrder = (userId, o = {}) => Order.create({
  user: userId,
  orderItems: [{ ...item, product: new mongoose.Types.ObjectId() }],
  deliveryAddress: { fullName: "Ada Obi", phone: "08031112222", address: "1 St", city: "Umuahia", state: "Abia" },
  itemsPrice: 15000, deliveryPrice: 2500, totalPrice: 17500,
  ...o,
});

describe("admin customers", () => {
  it("lists customers with orders, spend and phone, newest first; admins excluded", async () => {
    const admin = await register("admin@example.com", { isAdmin: true, name: "MD" });
    const ada = await register("ada@example.com", { name: "Ada Obi" });
    await register("bola@example.com", { name: "Bola Ade" });
    await makeOrder(ada.id, { isPaid: true, status: "delivered" });
    await makeOrder(ada.id, { isPaid: true, status: "cancelled" }); // refunded: not spend
    await makeOrder(ada.id, { status: "pending" });

    const res = await request(app).get("/api/admin/customers").set(admin.headers);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.customers.map((c) => c.email)).toEqual(["bola@example.com", "ada@example.com"]);
    const a = res.body.customers[1];
    expect(a).toMatchObject({ name: "Ada Obi", ordersCount: 3, paidOrders: 1, totalSpent: 17500, phone: "08031112222" });
    expect(a.password).toBeUndefined();

    const bySpend = await request(app).get("/api/admin/customers?sort=spent").set(admin.headers);
    expect(bySpend.body.customers[0].email).toBe("ada@example.com");
    const search = await request(app).get("/api/admin/customers?search=bola").set(admin.headers);
    expect(search.body.customers.map((c) => c.email)).toEqual(["bola@example.com"]);
    // Regex characters are treated as text, not patterns.
    expect((await request(app).get("/api/admin/customers?search=.*").set(admin.headers)).body.total).toBe(0);
    const paged = await request(app).get("/api/admin/customers?limit=1&page=2").set(admin.headers);
    expect(paged.body).toMatchObject({ page: 2, pages: 2 });
    expect(paged.body.customers).toHaveLength(1);
    expect((await request(app).get("/api/admin/customers?sort=hacked").set(admin.headers)).status).toBe(400);
  });

  it("shows one customer's orders, stats and notes; staff can add and delete notes", async () => {
    const admin = await register("admin@example.com", { isAdmin: true, name: "MD" });
    const ada = await register("ada@example.com", { name: "Ada Obi" });
    await makeOrder(ada.id, { isPaid: true, status: "delivered", totalPrice: 10000 });
    await makeOrder(ada.id, { isPaid: true, status: "paid", totalPrice: 20000 });

    const note = await request(app).post(`/api/admin/customers/${ada.id}/notes`).set(admin.headers).send({ text: "  Prefers bone straight wigs  " });
    expect(note.status).toBe(201);
    expect(note.body).toMatchObject({ text: "Prefers bone straight wigs", author: "MD" });
    expect((await request(app).post(`/api/admin/customers/${ada.id}/notes`).set(admin.headers).send({ text: "  " })).status).toBe(400);

    const res = await request(app).get(`/api/admin/customers/${ada.id}`).set(admin.headers);
    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({ name: "Ada Obi", email: "ada@example.com", phone: "08031112222" });
    expect(res.body.stats).toMatchObject({ ordersCount: 2, paidOrders: 2, totalSpent: 30000, averageOrderValue: 15000 });
    expect(res.body.orders[0].itemsCount).toBe(2);
    expect(res.body.orders[0].deliveryAddress).toBeUndefined();
    expect(res.body.notes.map((n) => n.text)).toEqual(["Prefers bone straight wigs"]);
    expect(JSON.stringify(res.body)).not.toMatch(/password|otpCodeHash/);

    const del = await request(app).delete(`/api/admin/customers/${ada.id}/notes/${note.body._id}`).set(admin.headers);
    expect(del.status).toBe(200);
    expect((await request(app).delete(`/api/admin/customers/${ada.id}/notes/${note.body._id}`).set(admin.headers)).status).toBe(404);
  });

  it("404s for unknown ids and admin accounts, and is admin-only", async () => {
    const admin = await register("admin@example.com", { isAdmin: true });
    const customer = await register("c@example.com");
    expect((await request(app).get(`/api/admin/customers/${new mongoose.Types.ObjectId()}`).set(admin.headers)).status).toBe(404);
    expect((await request(app).get("/api/admin/customers/not-an-id").set(admin.headers)).status).toBe(404);
    expect((await request(app).get(`/api/admin/customers/${admin.id}`).set(admin.headers)).status).toBe(404);
    expect((await request(app).get("/api/admin/customers").set(customer.headers)).status).toBe(401);
    expect((await request(app).post(`/api/admin/customers/${customer.id}/notes`).set(customer.headers).send({ text: "hi" })).status).toBe(401);
    expect(await CustomerNote.countDocuments()).toBe(0);
  });
});
