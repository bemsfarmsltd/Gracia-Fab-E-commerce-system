import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import StoreSale from "../models/StoreSale.js";
import StockMovement from "../models/StockMovement.js";
import Counter from "../models/Counter.js";
import generateToken from "../utils/generateToken.js";
import { markOrderPaid } from "../services/orderPayment.js";
import { averageCost } from "../services/costing.js";
import { reconcile } from "../services/stock.js";

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
  await Promise.all([User, Product, Order, Supplier, Purchase, StoreSale, StockMovement, Counter].map((M) => M.deleteMany({})));
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (u) => generateToken(u._id, { isAdmin: true });
const owner = () => User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = () => User.create({ name: "Chioma", email: "chioma@example.com", password: "password123", role: "staff" });
const product = (name, price, stock, extra = {}) => Product.create({ name, description: "d", price, image: "/x.jpg", category: "skincare", stock, ...extra });

describe("cost prices stay private", () => {
  it("never sends costs or suppliers to shoppers or staff", async () => {
    const sup = await Supplier.create({ name: "Lagos Wholesale" });
    const p = await product("Shea Body Butter", 7500, 10, { costPrice: 4000, lastCost: 4200, supplier: sup._id });
    const pub = await request(app).get("/api/products").expect(200);
    const list = Array.isArray(pub.body) ? pub.body : pub.body.products;
    expect(JSON.stringify(list)).not.toMatch(/costPrice|lastCost|"supplier"/);
    const one = await request(app).get(`/api/products/${p._id}`).expect(200);
    expect(one.body).not.toHaveProperty("costPrice");
    expect(one.body).not.toHaveProperty("supplier");

    const t = tokenFor(await staff());
    const adminList = await request(app).get("/api/admin/products").set(bearer(t)).expect(200);
    expect(JSON.stringify(adminList.body)).not.toMatch(/costPrice|lastCost/);
    for (const path of ["/api/admin/suppliers", "/api/admin/costing/products", "/api/admin/costing/reorder", "/api/admin/reports/profit", "/api/admin/purchases"]) {
      expect((await request(app).get(path).set(bearer(t))).status, path).toBe(403);
    }
  });

  it("doesn't show staff the cost recorded on stock movements", async () => {
    const chioma = await staff();
    const p = await product("Shea Body Butter", 7500, 10, { costPrice: 4000 });
    await request(app).post("/api/admin/stock/movements").set(bearer(tokenFor(chioma))).send({ productId: String(p._id), reason: "damaged", quantity: 1 }).expect(201);
    const hist = await request(app).get(`/api/admin/stock/movements?product=${p._id}`).set(bearer(tokenFor(chioma))).expect(200);
    expect(JSON.stringify(hist.body)).not.toMatch(/unitCost|4000/);
  });
});

describe("deliveries with costs", () => {
  it("averages the cost of what's on the shelf", () => {
    expect(averageCost({ stockBefore: 10, costBefore: 1000, quantity: 10, unitCost: 1500 })).toBe(1250);
    expect(averageCost({ stockBefore: 0, costBefore: 1000, quantity: 5, unitCost: 1500 })).toBe(1500);
    expect(averageCost({ stockBefore: 4, costBefore: undefined, quantity: 5, unitCost: 900 })).toBe(900);
  });

  it("records a delivery: stock up, costs updated, supplier set, in the history", async () => {
    const md = await owner();
    const t = tokenFor(md);
    const sup = (await request(app).post("/api/admin/suppliers").set(bearer(t)).send({ name: "Lagos Wholesale", phone: "0803 000 0000" }).expect(201)).body;
    const shea = await product("Shea Body Butter", 7500, 10, { costPrice: 4000 });
    const oil = await product("Hair Oil", 4000, 0);

    const res = await request(app).post("/api/admin/purchases").set(bearer(t)).send({
      supplierId: sup._id, invoiceRef: "INV-77",
      items: [{ productId: String(shea._id), quantity: 10, unitCost: 5000 }, { productId: String(oil._id), quantity: 6, unitCost: 2000 }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ supplierName: "Lagos Wholesale", total: 62000, receivedByName: "Gracia MD" });
    expect(res.body.items[0]).toMatchObject({ costBefore: 4000, costAfter: 4500 });

    const s = await Product.findById(shea._id).select("+costPrice +lastCost +supplier");
    expect(s).toMatchObject({ stock: 20, costPrice: 4500, lastCost: 5000 });
    expect(String(s.supplier)).toBe(sup._id);
    const o = await Product.findById(oil._id).select("+costPrice");
    expect(o).toMatchObject({ stock: 6, costPrice: 2000 });

    const move = await StockMovement.findOne({ product: shea._id, reason: "received" }).select("+unitCost").lean();
    expect(move).toMatchObject({ change: 10, unitCost: 5000, note: "From Lagos Wholesale, invoice INV-77" });
    expect((await reconcile(shea._id)).matches).toBe(true);

    const costing = await request(app).get("/api/admin/costing/products").set(bearer(t)).expect(200);
    const row = costing.body.products.find((p) => p.name === "Shea Body Butter");
    expect(row).toMatchObject({ costPrice: 4500, margin: 40, stockValue: 90000, supplier: { name: "Lagos Wholesale" } });
    expect(costing.body.totals.stockValue).toBe(90000 + 12000);
  });

  it("sets costs by hand and lists what needs reordering, by supplier", async () => {
    const t = tokenFor(await owner());
    const sup = await Supplier.create({ name: "Aba Hair Ltd" });
    const wig = await product("Bob Wig", 45000, 1);
    const shea = await product("Shea Body Butter", 7500, 10);
    await request(app).put(`/api/admin/costing/products/${wig._id}`).set(bearer(t)).send({ costPrice: 30000, supplierId: String(sup._id), reorderLevel: 2 }).expect(200);
    await request(app).put(`/api/admin/costing/products/${shea._id}`).set(bearer(t)).send({ reorderLevel: 3 }).expect(200);
    const r = await request(app).get("/api/admin/costing/reorder").set(bearer(t)).expect(200);
    expect(r.body.groups).toEqual([{ supplier: { _id: String(sup._id), name: "Aba Hair Ltd" }, products: [expect.objectContaining({ name: "Bob Wig", stock: 1, reorderLevel: 2 })] }]);
    expect((await request(app).put(`/api/admin/costing/products/${wig._id}`).set(bearer(t)).send({ costPrice: 12.5 })).status).toBe(400);
  });
});

describe("profit report", () => {
  it("uses the cost at the moment of each sale, online and shop together, after discounts", async () => {
    const md = await owner();
    const t = tokenFor(md);
    const buyer = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product("Shea Body Butter", 7500, 20, { costPrice: 4000 });
    const oil = await product("Hair Oil", 4000, 10); // no cost entered yet

    // Shop: 2 Shea + 1 Oil, ₦500 discount by the owner.
    await request(app).post("/api/admin/sales").set(bearer(t)).send({
      items: [{ productId: String(shea._id), quantity: 2 }, { productId: String(oil._id), quantity: 1 }],
      paymentMethod: "card", discount: 500, discountReason: "Loyal customer",
    }).expect(201);
    // Online: 1 Shea, paid.
    const order = await Order.create({
      user: buyer._id, orderItems: [{ product: shea._id, name: "Shea Body Butter", price: 7500, quantity: 1 }],
      itemsPrice: 7500, deliveryPrice: 2500, totalPrice: 10000, status: "pending", isPaid: false,
    });
    await markOrderPaid({ _id: order._id }, { reference: "GF-1", status: "PAID", amount: 10000 });
    // A voided shop sale nets to nothing.
    const voided = (await request(app).post("/api/admin/sales").set(bearer(t)).send({ items: [{ productId: String(shea._id), quantity: 1 }], paymentMethod: "cash", amountTendered: 7500 })).body;
    await request(app).post(`/api/admin/sales/${voided._id}/void`).set(bearer(t)).send({ reason: "Wrong item" }).expect(200);
    // The cost goes up afterwards: past profit must not change.
    await Product.updateOne({ _id: shea._id }, { costPrice: 6000 });

    const r = await request(app).get("/api/admin/reports/profit").set(bearer(t)).expect(200);
    const s = r.body.products.find((p) => p.name === "Shea Body Butter");
    expect(s).toMatchObject({ units: 3, onlineUnits: 1, shopUnits: 2, revenue: 22500, cost: 12000, profit: 10500, margin: 46.7 });
    const o = r.body.products.find((p) => p.name === "Hair Oil");
    expect(o).toMatchObject({ units: 1, revenue: 4000, cost: 0, unitsWithoutCost: 1, margin: null });
    expect(r.body.totals).toMatchObject({ units: 4, revenue: 26500, discounts: 500, netRevenue: 26000, cost: 12000, profit: 14000, unitsWithoutCost: 1 });
  });

  it("puts a cancelled online order's units and money back", async () => {
    const md = await owner();
    const buyer = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product("Shea Body Butter", 7500, 5, { costPrice: 4000 });
    const order = await Order.create({
      user: buyer._id, orderItems: [{ product: shea._id, name: "Shea Body Butter", price: 7500, quantity: 2 }],
      itemsPrice: 15000, deliveryPrice: 2500, totalPrice: 17500, status: "pending", isPaid: false,
    });
    await markOrderPaid({ _id: order._id }, { reference: "GF-2", status: "PAID", amount: 17500 });
    await Product.updateOne({ _id: shea._id }, { costPrice: 9000 }); // shouldn't matter
    await request(app).put(`/api/admin/orders/${order._id}/cancel`).set(bearer(tokenFor(md))).send({ reason: "Out of area" }).expect(200);
    const r = await request(app).get("/api/admin/reports/profit").set(bearer(tokenFor(md))).expect(200);
    expect(r.body.products).toEqual([]);
    expect(r.body.totals).toMatchObject({ units: 0, revenue: 0, cost: 0 });
  });
});
