import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import StoreSale from "../models/StoreSale.js";
import StockMovement from "../models/StockMovement.js";
import Counter from "../models/Counter.js";
import Order from "../models/Order.js";
import generateToken from "../utils/generateToken.js";
import { changeStock, reconcile } from "../services/stock.js";
import { startOfLagosDay } from "../controllers/storeSaleController.js";

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), StoreSale.deleteMany({}), StockMovement.deleteMany({}), Counter.deleteMany({}), Order.deleteMany({})]);
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (u) => generateToken(u._id, { isAdmin: true });
const owner = () => User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = (name = "Chioma", email = "chioma@example.com") => User.create({ name, email, password: "password123", role: "staff" });
const product = (name, price, stock) => Product.create({ name, description: "d", price, image: "/x.jpg", category: "skincare", stock });
const sell = (t, body) => request(app).post("/api/admin/sales").set(bearer(t)).send(body);

describe("ringing up a shop sale", () => {
  it("sells at the product's price, takes stock off the shared count, numbers the sale and gives change", async () => {
    const t = tokenFor(await staff());
    const shea = await product("Shea Body Butter", 7500, 10);
    const oil = await product("Hair Oil", 4000, 3);

    const res = await sell(t, {
      items: [{ productId: String(shea._id), quantity: 2 }, { productId: String(oil._id), quantity: 1 }, { productId: String(shea._id), quantity: 1 }],
      paymentMethod: "cash", amountTendered: 30000, customerName: "Ada", customerPhone: "0803 000 0000",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      numberLabel: "S-000001", status: "completed", subtotal: 26500, total: 26500, amountTendered: 30000, change: 3500,
      soldByName: "Chioma", customerName: "Ada",
    });
    // The same product added twice is one line.
    expect(res.body.items.map((i) => [i.name, i.quantity, i.unitPrice, i.lineTotal])).toEqual([
      ["Shea Body Butter", 3, 7500, 22500],
      ["Hair Oil", 1, 4000, 4000],
    ]);
    expect((await Product.findById(shea._id)).stock).toBe(7);
    expect((await Product.findById(oil._id)).stock).toBe(2);

    const moves = await StockMovement.find({ reason: "store_sale" }).lean();
    expect(moves.map((m) => [m.productName, m.change, String(m.sale), m.actorName])).toEqual(expect.arrayContaining([
      ["Shea Body Butter", -3, res.body._id, "Chioma"],
      ["Hair Oil", -1, res.body._id, "Chioma"],
    ]));
    expect((await reconcile(shea._id)).matches).toBe(true);

    const second = await sell(t, { items: [{ productId: String(oil._id), quantity: 1 }], paymentMethod: "transfer", paymentReference: "TRF123" });
    expect(second.body.numberLabel).toBe("S-000002");
    expect(second.body.change).toBeUndefined();
  });

  it("refuses to sell what isn't on the shelf, and takes nothing", async () => {
    const t = tokenFor(await staff());
    const shea = await product("Shea Body Butter", 7500, 10);
    const wig = await product("Bob Wig", 45000, 1);
    const res = await sell(t, { items: [{ productId: String(shea._id), quantity: 2 }, { productId: String(wig._id), quantity: 2 }], paymentMethod: "card" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only 1 of "Bob Wig" left');
    expect((await Product.findById(shea._id)).stock).toBe(10);
    expect(await StoreSale.countDocuments()).toBe(0);
  });

  it("puts back what it took if the last item sells online mid-sale", async () => {
    const md = await owner();
    const shea = await product("Shea Body Butter", 7500, 5);
    const wig = await product("Bob Wig", 45000, 1);
    // Simulate the race: the wig sells online after the till's check.
    const realFind = Product.find.bind(Product);
    let raced = false;
    Product.find = (...args) => {
      const q = realFind(...args);
      const exec = q.lean.bind(q);
      q.lean = () => {
        const r = exec();
        return r.then(async (rows) => {
          if (!raced) { raced = true; await changeStock({ productId: wig._id, change: -1, reason: "online_sale" }); }
          return rows;
        });
      };
      return q;
    };
    try {
      const res = await sell(tokenFor(md), { items: [{ productId: String(shea._id), quantity: 2 }, { productId: String(wig._id), quantity: 1 }], paymentMethod: "cash", amountTendered: 60000 });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Only 0 of "Bob Wig" left. It may have just sold online/);
    } finally {
      Product.find = realFind;
    }
    expect((await Product.findById(shea._id)).stock).toBe(5);
    expect(await StoreSale.countDocuments()).toBe(0);
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("checks payment, discounts and input", async () => {
    const chioma = await staff();
    const md = await owner();
    const shea = await product("Shea Body Butter", 7500, 10);
    const one = [{ productId: String(shea._id), quantity: 1 }];

    expect((await sell(tokenFor(chioma), { items: one, paymentMethod: "cash", amountTendered: 5000 })).body.message).toMatch(/handed over ₦5,000, but the total is ₦7,500/);
    expect((await sell(tokenFor(chioma), { items: one, paymentMethod: "bitcoin" })).status).toBe(400);
    expect((await sell(tokenFor(chioma), { items: [], paymentMethod: "cash" })).status).toBe(400);
    // Discounts: owner only, with a reason.
    expect((await sell(tokenFor(chioma), { items: one, paymentMethod: "card", discount: 500, discountReason: "Loyal" })).status).toBe(403);
    expect((await sell(tokenFor(md), { items: one, paymentMethod: "card", discount: 500 })).status).toBe(400);
    const ok = await sell(tokenFor(md), { items: one, paymentMethod: "card", discount: 500, discountReason: "Loyal customer" });
    expect(ok.body).toMatchObject({ subtotal: 7500, discount: 500, total: 7000 });
    expect((await Product.findById(shea._id)).stock).toBe(9);
  });

  it("is refused to customers", async () => {
    const ada = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    const shea = await product("Shea Body Butter", 7500, 10);
    expect((await sell(generateToken(ada._id), { items: [{ productId: String(shea._id), quantity: 1 }], paymentMethod: "cash" })).status).toBe(401);
  });
});

describe("voiding and cashing up", () => {
  it("lets the owner void a sale, putting the stock back; staff can't, and it can't be voided twice", async () => {
    const chioma = await staff();
    const md = await owner();
    const shea = await product("Shea Body Butter", 7500, 10);
    const sale = (await sell(tokenFor(chioma), { items: [{ productId: String(shea._id), quantity: 4 }], paymentMethod: "cash", amountTendered: 30000 })).body;

    expect((await request(app).post(`/api/admin/sales/${sale._id}/void`).set(bearer(tokenFor(chioma))).send({ reason: "Mistake" })).status).toBe(403);
    expect((await request(app).post(`/api/admin/sales/${sale._id}/void`).set(bearer(tokenFor(md))).send({})).status).toBe(400);

    const voided = await request(app).post(`/api/admin/sales/${sale._id}/void`).set(bearer(tokenFor(md))).send({ reason: "Rang up the wrong item" });
    expect(voided.status).toBe(200);
    expect(voided.body).toMatchObject({ status: "voided", voidedByName: "Gracia MD", voidReason: "Rang up the wrong item" });
    expect((await Product.findById(shea._id)).stock).toBe(10);
    const back = await StockMovement.findOne({ reason: "store_void" }).lean();
    expect(back).toMatchObject({ change: 4, actorName: "Gracia MD" });
    expect((await request(app).post(`/api/admin/sales/${sale._id}/void`).set(bearer(tokenFor(md))).send({ reason: "Again" })).status).toBe(400);
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("shows staff only their own sales today; the owner sees all and the totals by payment method", async () => {
    const chioma = await staff();
    const emeka = await staff("Emeka", "emeka@example.com");
    const md = await owner();
    const shea = await product("Shea Body Butter", 7500, 50);
    const one = (qty) => [{ productId: String(shea._id), quantity: qty }];
    await sell(tokenFor(chioma), { items: one(1), paymentMethod: "cash", amountTendered: 7500 }).expect(201);
    await sell(tokenFor(chioma), { items: one(2), paymentMethod: "transfer" }).expect(201);
    await sell(tokenFor(emeka), { items: one(1), paymentMethod: "card" }).expect(201);
    // Yesterday's sale by Chioma: not in her list today.
    await StoreSale.create({
      number: 99, items: [{ product: shea._id, name: "Shea", unitPrice: 7500, quantity: 1, lineTotal: 7500 }],
      subtotal: 7500, total: 7500, paymentMethod: "cash", soldBy: chioma._id, status: "completed",
      createdAt: new Date(startOfLagosDay().getTime() - 3600 * 1000),
    });

    const mine = await request(app).get("/api/admin/sales").set(bearer(tokenFor(chioma))).expect(200);
    expect(mine.body.scope).toBe("mine-today");
    expect(mine.body.items.map((s) => s.total).sort()).toEqual([15000, 7500]);

    const myTotals = await request(app).get("/api/admin/sales/summary").set(bearer(tokenFor(chioma))).expect(200);
    expect(myTotals.body).toMatchObject({ sales: 2, total: 22500, units: 3 });
    expect(myTotals.body.byMethod).toEqual([
      { method: "cash", sales: 1, total: 7500, units: 1 },
      { method: "transfer", sales: 1, total: 15000, units: 2 },
    ]);

    const all = await request(app).get("/api/admin/sales/summary").set(bearer(tokenFor(md))).expect(200);
    expect(all.body).toMatchObject({ sales: 4, total: 37500, scope: "all" });

    // Staff can open their own receipt, not someone else's.
    const emekaSale = (await request(app).get("/api/admin/sales").set(bearer(tokenFor(emeka)))).body.items[0];
    expect((await request(app).get(`/api/admin/sales/${emekaSale._id}`).set(bearer(tokenFor(chioma)))).status).toBe(404);
    expect((await request(app).get(`/api/admin/sales/${emekaSale._id}`).set(bearer(tokenFor(emeka)))).status).toBe(200);
  });

  it("tells the till which payment methods and actions this person has", async () => {
    const chioma = await staff();
    const md = await owner();
    const s = await request(app).get("/api/admin/sales/options").set(bearer(tokenFor(chioma))).expect(200);
    expect(s.body.paymentMethods.map((m) => m.id)).toEqual(["cash", "transfer", "card"]);
    expect(s.body).toMatchObject({ canDiscount: false, canVoid: false });
    const o = await request(app).get("/api/admin/sales/options").set(bearer(tokenFor(md))).expect(200);
    expect(o.body).toMatchObject({ canDiscount: true, canVoid: true });
  });
});

describe("loyalty points for shop sales", () => {
  const customer = (o = {}) => User.create({ name: "Ngozi Okafor", email: "ngozi@example.com", password: "password123", ...o });

  it("finds a customer at the till by name, email or a phone from an online order, never staff or the owner", async () => {
    const t = tokenFor(await staff());
    await owner();
    const ngozi = await customer({ loyaltyPoints: 40 });
    await Order.collection.insertOne({
      user: ngozi._id, orderItems: [], totalPrice: 1, createdAt: new Date(),
      deliveryAddress: { fullName: "Ngozi", phone: "+234 803 111 2233", address: "1", city: "Umuahia", state: "Abia" },
    });
    const find = async (q) => (await request(app).get(`/api/admin/sales/customers?q=${encodeURIComponent(q)}`).set(bearer(t)).expect(200)).body;

    expect((await find("ngo"))[0]).toMatchObject({ name: "Ngozi Okafor", email: "ngozi@example.com", points: 40 });
    expect((await find("ngozi@ex")).length).toBe(1);
    // 0803 111 2233 and +234 803 111 2233 are the same number.
    expect((await find("0803 111 2233"))[0]).toMatchObject({ name: "Ngozi Okafor", phone: "+234 803 111 2233" });
    expect(await find("chioma")).toEqual([]); // staff
    expect(await find("gracia")).toEqual([]); // owner
    expect(await find("n")).toEqual([]); // too short
    expect(await find(".*")).toEqual([]); // not a pattern
  });

  it("gives the customer points like an online order, shows them on the receipt, and takes them back on void", async () => {
    const md = await owner();
    const t = tokenFor(await staff());
    const ngozi = await customer({ loyaltyPoints: 40 });
    const shea = await product("Shea Body Butter", 7500, 10);

    const res = await sell(t, { items: [{ productId: String(shea._id), quantity: 2 }], paymentMethod: "transfer", customerId: String(ngozi._id) }).expect(201);
    // ₦15,000 → 150 points; the customer's name goes on the receipt.
    expect(res.body).toMatchObject({ pointsAwarded: 150, customerPoints: 190, customerName: "Ngozi Okafor", customer: String(ngozi._id) });
    let after = await User.findById(ngozi._id).lean();
    expect(after.loyaltyPoints).toBe(190);
    expect(after.pointsHistory.at(-1)).toMatchObject({ points: 150, reason: "Shop purchase S-000001", type: "earn" });

    await request(app).post(`/api/admin/sales/${res.body._id}/void`).set(bearer(tokenFor(md))).send({ reason: "Rang up twice" }).expect(200);
    after = await User.findById(ngozi._id).lean();
    expect(after.loyaltyPoints).toBe(40);
    expect(after.pointsHistory.at(-1)).toMatchObject({ points: -150, reason: "Shop purchase S-000001 voided", type: "reversal" });
  });

  it("gives no points without a customer, and refuses staff or unknown accounts as the customer", async () => {
    const t = tokenFor(await staff());
    const other = await staff("Ada", "ada@example.com");
    const shea = await product("Shea Body Butter", 7500, 10);
    const plain = await sell(t, { items: [{ productId: String(shea._id), quantity: 1 }], paymentMethod: "cash" }).expect(201);
    expect(plain.body.pointsAwarded).toBe(0);
    expect(plain.body.customerPoints).toBeUndefined();

    await sell(t, { items: [{ productId: String(shea._id), quantity: 1 }], paymentMethod: "cash", customerId: String(other._id) }).expect(400);
    await sell(t, { items: [{ productId: String(shea._id), quantity: 1 }], paymentMethod: "cash", customerId: String(new mongoose.Types.ObjectId()) }).expect(400);
    // Nothing sold or taken for the refused ones.
    expect((await Product.findById(shea._id)).stock).toBe(9);
  });
});
