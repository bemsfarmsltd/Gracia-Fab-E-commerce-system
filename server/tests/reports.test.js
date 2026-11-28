import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StoreSale from "../models/StoreSale.js";
import generateToken from "../utils/generateToken.js";
import { csvCell } from "../controllers/reportController.js";

let mongod;
let admin;
let buyer;

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), StoreSale.deleteMany({})]);
  const reg = async (email) => (await request(app).post("/api/auth/register").send({ name: "Ada Obi", email, password: "password123" })).body.token;
  admin = { Authorization: `Bearer ${await reg("admin@example.com")}` };
  await User.updateOne({ email: "admin@example.com" }, { isAdmin: true });
  buyer = await User.findById((await User.create({ name: "Bisi", email: "bisi@example.com", password: "password123" }))._id);
});

const product = (name, stock = 10, price = 10000) =>
  Product.create({ name, description: "d", price, image: "https://example.com/x.jpg", category: "skincare", stock });

// Inserts an order directly, so dates and payment state can be set freely.
function order({ items, paidAt, createdAt = paidAt || new Date(), isPaid = Boolean(paidAt), status, discount = 0, extra = {} }) {
  const itemsPrice = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return Order.collection.insertOne({
    user: buyer._id,
    orderItems: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, product: i.product })),
    deliveryAddress: { fullName: "Bisi Ade", phone: "08030000000", address: "1 St", city: "Umuahia", state: "Abia" },
    itemsPrice,
    discount,
    deliveryPrice: 2500,
    totalPrice: itemsPrice - discount + 2500,
    isPaid,
    paidAt,
    status: status || (isPaid ? "processing" : "pending"),
    statusHistory: [],
    createdAt,
    updatedAt: createdAt,
    ...extra,
  });
}

// Inserts a till sale directly. `items` lines use the order-line shape above.
let receipt = 0;
async function shopSale({ items, total, discount = 0, method = "cash", status = "completed", createdAt = new Date(), soldBy, extra = {} }) {
  const lines = items || [{ name: "Shea Body Butter", price: total + discount, quantity: 1, product: new mongoose.Types.ObjectId() }];
  return StoreSale.collection.insertOne({
    number: ++receipt,
    items: lines.map((l) => ({ product: l.product, name: l.name, unitPrice: l.price, quantity: l.quantity, lineTotal: l.price * l.quantity })),
    subtotal: total + discount,
    discount,
    total,
    paymentMethod: method,
    soldBy: soldBy?._id || buyer._id,
    soldByName: soldBy?.name || "Till",
    status,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  });
}

const monthsAgo = (n, day = 15) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, day, 12));
};
const key = (d) => d.toISOString().slice(0, 7);

describe("sales report", () => {
  it("groups paid, non-cancelled sales by month and ranks best sellers", async () => {
    const serum = await product("Serum", 10, 10000);
    const wig = await product("Wig", 10, 60000);
    const line = (p, quantity) => ({ name: p.name, price: p.price, quantity, product: p._id });

    await order({ items: [line(serum, 2)], paidAt: monthsAgo(0) });
    await order({ items: [line(serum, 1), line(wig, 1)], paidAt: monthsAgo(0), discount: 5000 });
    await order({ items: [line(wig, 1)], paidAt: monthsAgo(2) });
    // Not sales: unpaid, cancelled-and-refunded, and outside the period.
    await order({ items: [line(wig, 5)] });
    await order({ items: [line(wig, 3)], paidAt: monthsAgo(0), status: "cancelled" });
    await order({ items: [line(serum, 9)], paidAt: monthsAgo(8) });

    const res = await request(app).get("/api/admin/reports/sales?months=3").set(admin);

    expect(res.status).toBe(200);
    expect(res.body.months.map((m) => m.month)).toEqual([key(monthsAgo(2)), key(monthsAgo(1)), key(monthsAgo(0))]);
    const [twoAgo, lastMonth, thisMonth] = res.body.months;
    expect(thisMonth).toMatchObject({ orders: 2, itemsSold: 4, revenue: 22500 + 67500, discounts: 5000, delivery: 5000, averageOrder: 45000 });
    expect(lastMonth).toMatchObject({ orders: 0, revenue: 0, averageOrder: 0 });
    expect(twoAgo).toMatchObject({ orders: 1, revenue: 62500 });
    expect(res.body.totals).toMatchObject({ orders: 3, revenue: 152500, itemsSold: 5 });

    expect(res.body.topProducts).toEqual([
      expect.objectContaining({ name: "Serum", units: 3, sales: 30000, orders: 2 }),
      expect.objectContaining({ name: "Wig", units: 2, sales: 120000, orders: 2 }),
    ]);
  });

  it("counts a sale by when it was paid, in Nigerian time", async () => {
    const serum = await product("Serum");
    const now = new Date();
    // 23:30 UTC on the last day of last month is 00:30 WAT on the 1st of this month.
    const edge = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 30 * 60 * 1000);
    await order({ items: [{ name: "Serum", price: 10000, quantity: 1, product: serum._id }], paidAt: edge, createdAt: monthsAgo(1, 20) });

    const res = await request(app).get("/api/admin/reports/sales?months=2").set(admin);
    expect(res.body.months.at(-1)).toMatchObject({ month: key(now), orders: 1 });
    expect(res.body.months[0].orders).toBe(0);
  });

  it("adds completed shop-till sales: revenue split, best sellers and how the till was paid", async () => {
    const serum = await product("Serum", 10, 10000);
    const wig = await product("Wig", 10, 60000);
    const line = (p, quantity) => ({ name: p.name, price: p.price, quantity, product: p._id });
    await order({ items: [line(serum, 1)], paidAt: monthsAgo(0) }); // 12,500 incl. delivery

    await shopSale({ items: [line(serum, 2)], total: 18000, discount: 2000, method: "cash", createdAt: monthsAgo(0) });
    await shopSale({ items: [line(wig, 1)], total: 60000, method: "card", createdAt: monthsAgo(1) });
    await shopSale({ items: [line(wig, 4)], total: 240000, status: "voided", createdAt: monthsAgo(0) });
    await shopSale({ items: [line(wig, 4)], total: 240000, status: "processing", createdAt: monthsAgo(0) });

    const res = await request(app).get("/api/admin/reports/sales?months=2").set(admin);
    expect(res.status).toBe(200);
    const [lastMonth, thisMonth] = res.body.months;
    expect(thisMonth).toMatchObject({
      revenue: 30500, onlineRevenue: 12500, shopRevenue: 18000, orders: 1, shopSales: 1,
      itemsSold: 3, discounts: 2000, delivery: 2500, averageOrder: 12500,
    });
    expect(lastMonth).toMatchObject({ revenue: 60000, onlineRevenue: 0, shopRevenue: 60000, orders: 0, shopSales: 1, averageOrder: 0 });
    expect(res.body.totals).toMatchObject({ revenue: 90500, onlineRevenue: 12500, shopRevenue: 78000, orders: 1, shopSales: 2, itemsSold: 4, averageOrder: 12500 });
    expect(res.body.totals.shopByMethod).toEqual([
      { method: "cash", label: "Cash", sales: 1, total: 18000 },
      { method: "transfer", label: "Bank transfer", sales: 0, total: 0 },
      { method: "card", label: "POS card", sales: 1, total: 60000 },
    ]);
    expect(res.body.topProducts).toEqual([
      expect.objectContaining({ name: "Serum", units: 3, onlineUnits: 1, shopUnits: 2, sales: 30000, orders: 1, shopSales: 1 }),
      expect.objectContaining({ name: "Wig", units: 1, onlineUnits: 0, shopUnits: 1, sales: 60000, orders: 0, shopSales: 1 }),
    ]);
  });

  it("is admin only", async () => {
    expect((await request(app).get("/api/admin/reports/sales")).status).toBe(401);
    expect((await request(app).get("/api/admin/orders/export")).status).toBe(401);
  });
});

describe("dashboard stats", () => {
  it("lists low-stock products, counts out-of-stock ones, and leaves refunds out of revenue", async () => {
    await product("Nearly Gone", 2);
    await product("Last Few", 5);
    await product("Plenty", 6);
    await product("Sold Out", 0);
    await Product.collection.insertOne({ name: "Never Counted", description: "d", price: 1, image: "x", category: "skincare" });
    const p = await product("Paid For");
    const line = { name: "Paid For", price: 10000, quantity: 1, product: p._id };
    await order({ items: [line], paidAt: new Date() });
    await order({ items: [line], paidAt: new Date(), status: "cancelled" });

    const res = await request(app).get("/api/admin/stats").set(admin);

    expect(res.body.lowStockThreshold).toBe(5);
    expect(res.body.lowStock.map((x) => [x.name, x.stock])).toEqual([["Nearly Gone", 2], ["Last Few", 5]]);
    expect(res.body.outOfStockCount).toBe(2);
    expect(res.body.totalRevenue).toBe(12500);
  });
});

describe("order CSV export", () => {
  it("downloads every order with customer, items, money and payment columns", async () => {
    const serum = await product("Serum, 30ml");
    await order({
      items: [{ name: "Serum, 30ml", price: 10000, quantity: 2, product: serum._id }],
      paidAt: new Date("2026-11-10T10:00:00Z"),
      discount: 2000,
      extra: { voucher: { code: "BEAUTY20", discount: 2000 }, paymentResult: { channel: "CARD", transactionReference: "MNFY|42" } },
    });
    await order({ items: [{ name: "Serum, 30ml", price: 10000, quantity: 1, product: serum._id }], createdAt: new Date("2026-11-12T10:00:00Z") });

    const res = await request(app).get("/api/admin/orders/export").set(admin);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="gracia-fab-orders\.csv"/);
    const rows = res.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^Order ID,Placed \(WAT\),Customer,Email,/);
    // Newest first; the paid one is second.
    expect(rows[1]).toMatch(/,No,/);
    expect(rows[2]).toContain('"Serum, 30ml x2"');
    expect(rows[2]).toContain("bisi@example.com");
    expect(rows[2]).toContain(",BEAUTY20,2000,2500,20500,Yes,2026-11-10 11:00,CARD,MNFY|42,processing,");
  });

  it("filters by date in Nigerian time and rejects bad dates", async () => {
    const serum = await product("Serum");
    const item = [{ name: "Serum", price: 10000, quantity: 1, product: serum._id }];
    await order({ items: item, createdAt: new Date("2026-10-31T23:30:00Z") }); // 1 Nov 00:30 WAT
    await order({ items: item, createdAt: new Date("2026-10-31T22:30:00Z") }); // 31 Oct 23:30 WAT
    await order({ items: item, createdAt: new Date("2026-11-30T22:59:00Z") }); // 30 Nov 23:59 WAT

    const res = await request(app).get("/api/admin/orders/export?from=2026-11-01&to=2026-11-30").set(admin);
    expect(res.text.trim().split("\r\n")).toHaveLength(3);
    expect(res.headers["content-disposition"]).toContain("gracia-fab-orders-from-2026-11-01-to-2026-11-30.csv");

    expect((await request(app).get("/api/admin/orders/export?from=1/11/2026").set(admin)).status).toBe(400);
    expect((await request(app).get("/api/admin/orders/export?from=2026-02-31").set(admin)).status).toBe(400);
    expect((await request(app).get("/api/admin/orders/export?from=2026-12-01&to=2026-11-01").set(admin)).status).toBe(400);
  });

  it("downloads shop-till sales, voided ones marked, owner only", async () => {
    const cashier = await User.create({ name: "Till", email: "till@example.com", password: "password123", role: "staff" });
    await shopSale({ total: 9000, discount: 1000, method: "transfer", createdAt: new Date("2026-11-10T10:00:00Z"), soldBy: cashier, extra: { paymentReference: "TRF-1", customerName: "Ngozi" } });
    await shopSale({ total: 5000, status: "voided", createdAt: new Date("2026-11-12T10:00:00Z"), soldBy: cashier, extra: { voidReason: "Wrong item", voidedByName: "Owner" } });
    await shopSale({ total: 4000, createdAt: new Date("2026-10-31T22:30:00Z"), soldBy: cashier }); // 31 Oct WAT

    const res = await request(app).get("/api/admin/reports/shop-sales/export?from=2026-11-01&to=2026-11-30").set(admin);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("gracia-fab-shop-sales-from-2026-11-01-to-2026-11-30.csv");
    const rows = res.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^Receipt,Sold \(WAT\),Sold by,Items,/);
    expect(rows[1]).toContain(",voided,");
    expect(rows[1]).toContain("Wrong item");
    expect(rows[2]).toMatch(/^S-0000\d\d,2026-11-10 11:00,Till,Shea Body Butter x1,1,10000,1000,,9000,Bank transfer,TRF-1,Ngozi,,completed/);

    expect((await request(app).get("/api/admin/reports/shop-sales/export?from=2026-02-31").set(admin)).status).toBe(400);
    expect((await request(app).get("/api/admin/reports/shop-sales/export")).status).toBe(401);
    // Staff use the till but can't download the takings.
    const staffToken = generateToken(cashier._id, { isAdmin: true });
    expect((await request(app).get("/api/admin/reports/shop-sales/export").set({ Authorization: `Bearer ${staffToken}` })).status).toBe(403);
  });

  it("can't be used to plant spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe(`"'=HYPERLINK(""http://x"",""click"")"`);
    expect(csvCell("+2348030000000")).toBe("'+2348030000000");
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(0)).toBe("0");
  });
});
