import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";
import generateToken from "../utils/generateToken.js";
import { markOrderPaid } from "../services/orderPayment.js";
import { changeStock, reconcile } from "../services/stock.js";

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), StockMovement.deleteMany({})]);
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const owner = () => User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = () => User.create({ name: "Chioma", email: "chioma@example.com", password: "password123", role: "staff" });
const tokenFor = (u) => generateToken(u._id, { isAdmin: true });
// A product that existed before stock history (no movements yet).
const product = (stock = 10, name = "Shea Body Butter") =>
  Product.create({ name, description: "d", price: 7500, image: "/x.jpg", category: "skincare", stock });
const history = (p) => StockMovement.find({ product: p._id }).sort({ createdAt: 1, _id: 1 }).lean();

async function paidOrder(buyer, items) {
  const order = await Order.create({
    user: buyer._id,
    orderItems: items.map(({ p, qty }) => ({ product: p._id, name: p.name, price: p.price, quantity: qty })),
    itemsPrice: 1, deliveryPrice: 2500, totalPrice: 2501, status: "pending", isPaid: false,
  });
  return markOrderPaid({ _id: order._id }, { reference: "GF-1", status: "PAID", amount: 2501 });
}

describe("stock history: automatic movements", () => {
  it("records an online sale against the order, with an opening balance first", async () => {
    const buyer = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product(10);
    const order = await paidOrder(buyer, [{ p: shea, qty: 3 }]);

    const moves = await history(shea);
    expect(moves.map((m) => [m.reason, m.change, m.balanceAfter])).toEqual([
      ["opening", 10, 10],
      ["online_sale", -3, 7],
    ]);
    expect(String(moves[1].order)).toBe(String(order._id));
    expect((await Product.findById(shea._id)).stock).toBe(7);
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("records stock put back when the owner cancels a paid order, under their name", async () => {
    const md = await owner();
    const buyer = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product(5);
    const order = await paidOrder(buyer, [{ p: shea, qty: 2 }]);

    await request(app).put(`/api/admin/orders/${order._id}/cancel`).set(bearer(tokenFor(md))).send({ reason: "Customer changed mind" }).expect(200);
    const last = (await history(shea)).at(-1);
    expect(last).toMatchObject({ reason: "online_cancel", change: 2, balanceAfter: 5, actorName: "Gracia MD" });
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("records a new product's starting stock, product-page edits and Inventory counts", async () => {
    const md = await owner();
    const t = tokenFor(md);
    const created = await request(app).post("/api/admin/products").set(bearer(t)).send({
      name: "Bob Wig", description: "Short bob", price: 45000, image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/x.jpg", category: "wigs", stock: 4,
    }).expect(201);
    const id = created.body._id;

    const edited = await request(app).put(`/api/admin/products/${id}`).set(bearer(t)).send({ stock: 6, price: 46000 }).expect(200);
    expect(edited.body).toMatchObject({ stock: 6, price: 46000, isInStock: true });

    await request(app).put("/api/admin/products/stock").set(bearer(t)).send({ updates: [{ id, stock: 0 }] }).expect(200);
    // Same count again: nothing to record.
    await request(app).put("/api/admin/products/stock").set(bearer(t)).send({ updates: [{ id, stock: 0 }] }).expect(200);

    const moves = await StockMovement.find({ product: id }).sort({ createdAt: 1, _id: 1 }).lean();
    expect(moves.map((m) => [m.reason, m.change, m.balanceAfter])).toEqual([
      ["initial", 4, 4],
      ["count", 2, 6],
      ["count", -6, 0],
    ]);
    expect(moves.every((m) => m.actorName === "Gracia MD")).toBe(true);
    const p = await Product.findById(id);
    expect(p).toMatchObject({ stock: 0, isInStock: false });
    expect((await reconcile(id)).matches).toBe(true);
  });
});

describe("stock history: deliveries and write-offs", () => {
  it("lets staff record a delivery and a write-off, never below zero", async () => {
    const chioma = await staff();
    const t = tokenFor(chioma);
    const shea = await product(2);

    const received = await request(app).post("/api/admin/stock/movements").set(bearer(t))
      .send({ productId: String(shea._id), reason: "received", quantity: 12, note: "Delivery from supplier" });
    expect(received.status).toBe(201);
    expect(received.body.stock).toBe(14);
    expect(received.body.movement).toMatchObject({ reason: "received", change: 12, balanceAfter: 14, actorName: "Chioma" });

    const damaged = await request(app).post("/api/admin/stock/movements").set(bearer(t))
      .send({ productId: String(shea._id), reason: "damaged", quantity: 3, note: "Jars cracked" });
    expect(damaged.body.stock).toBe(11);
    expect(damaged.body.movement.change).toBe(-3);

    const tooMany = await request(app).post("/api/admin/stock/movements").set(bearer(t))
      .send({ productId: String(shea._id), reason: "expired", quantity: 50 });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/Only 11 of "Shea Body Butter" in stock/);
    expect((await Product.findById(shea._id)).stock).toBe(11);
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("asks for a reason on corrections and refuses nonsense amounts", async () => {
    const t = tokenFor(await owner());
    const shea = await product(5);
    const send = (body) => request(app).post("/api/admin/stock/movements").set(bearer(t)).send({ productId: String(shea._id), ...body });
    expect((await send({ reason: "correction", quantity: -1 })).status).toBe(400);
    expect((await send({ reason: "received", quantity: 0 })).status).toBe(400);
    expect((await send({ reason: "received", quantity: -4 })).status).toBe(400);
    expect((await send({ reason: "store_sale", quantity: 1 })).status).toBe(400); // only the till records shop sales
    const ok = await send({ reason: "correction", quantity: -1, note: "Miscounted last week" });
    expect(ok.status).toBe(201);
    expect(ok.body.stock).toBe(4);
  });

  it("never sells the last unit twice when two sales land at once", async () => {
    const shea = await product(1);
    const results = await Promise.all([
      changeStock({ productId: shea._id, change: -1, reason: "online_sale" }),
      changeStock({ productId: shea._id, change: -1, reason: "store_sale" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await Product.findById(shea._id)).stock).toBe(0);
  });

  it("is refused to customers", async () => {
    const ada = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product(5);
    const t = generateToken(ada._id);
    expect((await request(app).post("/api/admin/stock/movements").set(bearer(t)).send({ productId: String(shea._id), reason: "received", quantity: 1 })).status).toBe(401);
    expect((await request(app).get("/api/admin/stock/movements").set(bearer(t))).status).toBe(401);
  });
});

describe("reading the history", () => {
  it("lists a product's movements newest first with labels, order numbers and whether it adds up", async () => {
    const md = await owner();
    const t = tokenFor(md);
    const buyer = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product(10);
    const other = await product(3, "Bob Wig");
    const order = await paidOrder(buyer, [{ p: shea, qty: 2 }]);
    await request(app).post("/api/admin/stock/movements").set(bearer(t)).send({ productId: String(shea._id), reason: "received", quantity: 5 }).expect(201);
    await request(app).post("/api/admin/stock/movements").set(bearer(t)).send({ productId: String(other._id), reason: "lost", quantity: 1 }).expect(201);

    const res = await request(app).get(`/api/admin/stock/movements?product=${shea._id}`).set(bearer(t)).expect(200);
    expect(res.body.items.map((m) => m.reason)).toEqual(["received", "online_sale", "opening"]);
    expect(res.body.items[1]).toMatchObject({ orderNumber: String(order._id).slice(-8).toUpperCase(), actorName: "Customer payment", reasonLabel: "Sold online (paid)" });
    expect(res.body.reconciliation).toMatchObject({ stock: 13, movementsTotal: 13, matches: true });

    const outs = await request(app).get("/api/admin/stock/movements?reason=out").set(bearer(t)).expect(200);
    expect(outs.body.items.map((m) => [m.productName, m.change])).toEqual([["Bob Wig", -1], ["Shea Body Butter", -2]]);

    const summary = await request(app).get("/api/admin/stock/summary").set(bearer(t)).expect(200);
    const byReason = Object.fromEntries(summary.body.byReason.map((r) => [r.reason, r.units]));
    expect(byReason).toMatchObject({ online_sale: -2, received: 5, lost: -1 });
    expect(byReason.opening).toBeUndefined();
  });

  it("spots a count changed outside the stock service", async () => {
    const shea = await product(10);
    await changeStock({ productId: shea._id, change: -1, reason: "store_sale" });
    await Product.updateOne({ _id: shea._id }, { stock: 50 }); // e.g. an old script
    expect(await reconcile(shea._id)).toMatchObject({ stock: 50, movementsTotal: 9, matches: false });
  });
});
