import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Voucher from "../models/Voucher.js";
import { ADVERTISED_VOUCHERS } from "../services/vouchers.js";
import { _resetMonnifyTokenCache } from "../services/monnify.js";

let mongod;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.MONNIFY_API_KEY = "MK_TEST_dummy";
  process.env.MONNIFY_SECRET_KEY = "secret_dummy";
  process.env.MONNIFY_CONTRACT_CODE = "1234567890";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), Voucher.deleteMany({})]);
  await Voucher.insertMany(ADVERTISED_VOUCHERS);
  fetch.mockReset();
  _resetMonnifyTokenCache();
});

const deliveryAddress = { fullName: "Ada Buyer", phone: "08030000000", address: "1 St", city: "Lagos", state: "Lagos" };

async function register(email, isAdmin = false) {
  const res = await request(app).post("/api/auth/register").send({ name: "Someone", email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return res.body.token;
}

function mockMonnifyPaid(amountPaid, email) {
  fetch.mockImplementation(async (url) => ({
    status: 200,
    json: async () =>
      String(url).includes("/auth/login")
        ? { requestSuccessful: true, responseBody: { accessToken: "t", expiresIn: 3600 } }
        : {
            requestSuccessful: true,
            responseBody: {
              paymentReference: new URL(url).searchParams.get("paymentReference"),
              transactionReference: "MNFY|1",
              paymentStatus: "PAID",
              amountPaid: String(amountPaid),
              customer: { email },
            },
          },
  }));
}

// A customer places (and optionally pays for) an order of 2 × ₦30,000 with BEAUTY20.
async function placeOrder({ pay = true } = {}) {
  const buyerEmail = "buyer@example.com";
  const buyer = await register(buyerEmail);
  const admin = await register("admin@example.com", true);
  const product = await Product.create({
    name: "Raw Hair Wig", description: "d", price: 30000, image: "https://example.com/w.jpg", category: "wig", stock: 10,
  });
  const created = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${buyer}`)
    .send({ orderItems: [{ product: product._id, quantity: 2 }], deliveryAddress, voucherCode: "BEAUTY20" });
  let order = created.body;
  if (pay) {
    await request(app).post(`/api/orders/${order._id}/pay/init`).set("Authorization", `Bearer ${buyer}`);
    mockMonnifyPaid(order.totalPrice, buyerEmail);
    order = (await request(app).put(`/api/orders/${order._id}/pay`).set("Authorization", `Bearer ${buyer}`).send({})).body;
  }
  return { buyer, admin, product, order, buyerEmail };
}

const cancel = (admin, id, reason = "Customer changed their mind") =>
  request(app).put(`/api/admin/orders/${id}/cancel`).set("Authorization", `Bearer ${admin}`).send({ reason });

describe("cancelling orders", () => {
  it("cancels a paid order: stock back, voucher freed, points reversed, refund due", async () => {
    const { admin, product, order, buyerEmail } = await placeOrder();
    expect(order.isPaid).toBe(true);
    expect((await Product.findById(product._id)).stock).toBe(8);
    expect((await Voucher.findOne({ code: "BEAUTY20" })).usedCount).toBe(1);
    // Points are awarded by a background queue (not running in tests), so set them.
    await User.updateOne({ email: buyerEmail }, { loyaltyPoints: 1000 });

    const res = await cancel(admin, order._id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.refund).toMatchObject({ status: "pending", amount: 50500 }); // 60,000 − 12,000 + 2,500
    expect(res.body.statusHistory.at(-1).note).toMatch(/Refund of ₦50,500 due/);

    const p = await Product.findById(product._id);
    expect(p.stock).toBe(10);
    expect(p.isInStock).toBe(true);
    expect((await Voucher.findOne({ code: "BEAUTY20" })).usedCount).toBe(0);
    const user = await User.findOne({ email: buyerEmail });
    expect(user.loyaltyPoints).toBe(1000 - 505);
    expect(user.pointsHistory.at(-1)).toMatchObject({ points: -505, type: "reversal" });
  });

  it("cancels an unpaid order with nothing to refund or restock", async () => {
    const { admin, product, order } = await placeOrder({ pay: false });
    const res = await cancel(admin, order._id);
    expect(res.status).toBe(200);
    expect(res.body.refund.status).toBe("none");
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await Voucher.findOne({ code: "BEAUTY20" })).usedCount).toBe(0);
  });

  it("returns stock only once, even when cancel is clicked twice at the same moment", async () => {
    const { admin, product, order } = await placeOrder();
    const [a, b] = await Promise.all([cancel(admin, order._id), cancel(admin, order._id)]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect((await Product.findById(product._id)).stock).toBe(10);
  });

  it("refuses to cancel twice, or after the order has shipped", async () => {
    const { admin, order } = await placeOrder();
    await cancel(admin, order._id);
    expect((await cancel(admin, order._id)).body.message).toMatch(/already cancelled/);

    // Now pretend the same order had shipped instead.
    await Order.updateOne({ _id: order._id }, { status: "shipped", "refund.status": "none" });
    const res = await cancel(admin, order._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already shipped.*return/);
  });

  it("only returns stock that payment actually took (items short at payment aren't added back)", async () => {
    const { admin, product, order } = await placeOrder();
    // Simulate: payment found this item out of stock, so nothing was taken.
    await Product.updateOne({ _id: product._id }, { stock: 0 });
    await Order.updateOne({ _id: order._id }, { stockCommitted: [{ product: product._id, quantity: 0 }] });
    await cancel(admin, order._id);
    expect((await Product.findById(product._id)).stock).toBe(0);
  });

  it("returns all items for older paid orders made before stock was tracked per order", async () => {
    const admin = await register("admin@example.com", true);
    const buyer = await User.create({ name: "Old", email: "old@example.com", password: "password123" });
    const product = await Product.create({ name: "Serum", description: "d", price: 5000, image: "x", category: "skincare", stock: 3 });
    const legacy = await Order.create({
      user: buyer._id,
      orderItems: [{ product: product._id, name: "Serum", image: "x", price: 5000, quantity: 2 }],
      itemsPrice: 10000, deliveryPrice: 2500, totalPrice: 12500, isPaid: true, status: "processing",
    });
    const res = await cancel(admin, legacy._id);
    expect(res.status).toBe(200);
    expect((await Product.findById(product._id)).stock).toBe(5);
  });

  it("choosing 'Cancelled' in the admin status menu does the same thing", async () => {
    const { admin, product, order } = await placeOrder();
    const res = await request(app)
      .put(`/api/admin/orders/${order._id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ status: "cancelled", note: "Out of stock at warehouse" });
    expect(res.status).toBe(200);
    expect(res.body.cancelReason).toBe("Out of stock at warehouse");
    expect(res.body.refund.status).toBe("pending");
    expect((await Product.findById(product._id)).stock).toBe(10);
  });

  it("needs a reason, and is admin-only", async () => {
    const { buyer, admin, order } = await placeOrder();
    expect((await cancel(admin, order._id, "")).status).toBe(400);
    expect((await cancel(buyer, order._id)).status).toBe(401);
  });
});

describe("recording refunds", () => {
  const refund = (admin, id, body) =>
    request(app).put(`/api/admin/orders/${id}/refund`).set("Authorization", `Bearer ${admin}`).send(body);

  it("records the Monnify reference once the refund is sent", async () => {
    const { admin, order } = await placeOrder();
    await cancel(admin, order._id);

    const res = await refund(admin, order._id, { reference: "MNFY|REFUND|123" });
    expect(res.status).toBe(200);
    expect(res.body.refund).toMatchObject({ status: "refunded", reference: "MNFY|REFUND|123", amount: 50500 });

    const again = await refund(admin, order._id, { reference: "MNFY|REFUND|123" });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already recorded/);
  });

  it("refuses when there's no refund due", async () => {
    const { admin, order } = await placeOrder({ pay: false });
    expect((await refund(admin, order._id, { reference: "MNFY|X|1" })).body.message).toMatch(/no refund due/);
    await cancel(admin, order._id);
    expect((await refund(admin, order._id, { reference: "MNFY|X|1" })).body.message).toMatch(/no refund due/);
  });
});
