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
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Voucher.deleteMany({}),
  ]);
  await Voucher.insertMany(ADVERTISED_VOUCHERS);
  fetch.mockReset();
  _resetMonnifyTokenCache();
});

const deliveryAddress = {
  fullName: "Buyer",
  phone: "08000000000",
  address: "1 St",
  city: "Lagos",
  state: "Lagos",
};

async function registerUser({ email = "buyer@example.com", isAdmin = false } = {}) {
  const res = await request(app).post("/api/auth/register").send({ name: "Buyer", email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return { token: res.body.token, email };
}

function product(price, stock = 100) {
  return Product.create({
    name: `Item ${price}`,
    description: "d",
    price,
    image: "https://example.com/i.jpg",
    category: "skincare",
    stock,
  });
}

function order(token, items, voucherCode) {
  return request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({ orderItems: items, deliveryAddress, ...(voucherCode ? { voucherCode } : {}) });
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

async function payFor(token, orderBody, email) {
  await request(app).post(`/api/orders/${orderBody._id}/pay/init`).set("Authorization", `Bearer ${token}`);
  mockMonnifyPaid(orderBody.totalPrice, email);
  return request(app).put(`/api/orders/${orderBody._id}/pay`).set("Authorization", `Bearer ${token}`).send({});
}

describe("public vouchers", () => {
  it("lists the advertised codes with labels built from their real rules", async () => {
    const res = await request(app).get("/api/vouchers/public");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { code: "GLOW05", discountLabel: "5% OFF", conditionLabel: "First order only" },
      { code: "BEAUTY20", discountLabel: "20% OFF", conditionLabel: "Min spend ₦25,000" },
      { code: "LUXE5K", discountLabel: "₦5,000 OFF", conditionLabel: "Min spend ₦50,000" },
    ]);
  });

  it("hides inactive, expired and fully redeemed vouchers", async () => {
    await Voucher.updateOne({ code: "GLOW05" }, { active: false });
    await Voucher.updateOne({ code: "BEAUTY20" }, { expiresAt: new Date(Date.now() - 1000) });
    await Voucher.updateOne({ code: "LUXE5K" }, { usageLimit: 1, usedCount: 1 });
    const res = await request(app).get("/api/vouchers/public");
    expect(res.body).toEqual([]);
  });
});

describe("vouchers at checkout", () => {
  it("BEAUTY20 takes 20% off the items from ₦25,000, never the delivery fee", async () => {
    const { token } = await registerUser();
    const p = await product(30000);
    const res = await order(token, [{ product: p._id, quantity: 1 }], "beauty20");

    expect(res.status).toBe(201);
    expect(res.body.discount).toBe(6000);
    expect(res.body.voucher.code).toBe("BEAUTY20");
    expect(res.body.totalPrice).toBe(30000 - 6000 + 2500);
  });

  it("refuses BEAUTY20 below the minimum spend, with the amounts", async () => {
    const { token } = await registerUser();
    const p = await product(20000);
    const res = await order(token, [{ product: p._id, quantity: 1 }], "BEAUTY20");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/minimum spend of ₦25,000.*₦20,000/);
  });

  it("LUXE5K takes ₦5,000 off from ₦50,000", async () => {
    const { token } = await registerUser();
    const p = await product(25000);
    const res = await order(token, [{ product: p._id, quantity: 2 }], "LUXE5K");
    expect(res.body.discount).toBe(5000);
    expect(res.body.totalPrice).toBe(50000 - 5000 + 2500);
  });

  it("GLOW05 works on a first order but not after a paid one, and counts as used only once paid", async () => {
    const { token, email } = await registerUser();
    const p = await product(10000);

    const first = await order(token, [{ product: p._id, quantity: 1 }], "GLOW05");
    expect(first.status).toBe(201);
    expect(first.body.discount).toBe(500);
    expect((await Voucher.findOne({ code: "GLOW05" })).usedCount).toBe(0);

    const paid = await payFor(token, first.body, email);
    expect(paid.status).toBe(200);
    expect((await Voucher.findOne({ code: "GLOW05" })).usedCount).toBe(1);

    const second = await order(token, [{ product: p._id, quantity: 1 }], "GLOW05");
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/first order only/);
  });

  it("rejects unknown, inactive, expired and used-up codes", async () => {
    const { token } = await registerUser();
    const p = await product(60000);
    const items = [{ product: p._id, quantity: 1 }];

    expect((await order(token, items, "NOPE123")).body.message).toMatch(/isn't valid/);
    await Voucher.updateOne({ code: "LUXE5K" }, { active: false });
    expect((await order(token, items, "LUXE5K")).body.message).toMatch(/isn't valid/);
    await Voucher.updateOne({ code: "BEAUTY20" }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await order(token, items, "BEAUTY20")).body.message).toMatch(/expired/);
    await Voucher.updateOne({ code: "GLOW05" }, { usageLimit: 3, usedCount: 3 });
    expect((await order(token, items, "GLOW05")).body.message).toMatch(/fully redeemed/);
  });

  it("previews a code for the checkout page", async () => {
    const { token } = await registerUser();
    const ok = await request(app)
      .post("/api/vouchers/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "luxe5k", subtotal: 60000 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ code: "LUXE5K", discount: 5000, discountLabel: "₦5,000 OFF" });

    const tooLow = await request(app)
      .post("/api/vouchers/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "LUXE5K", subtotal: 10000 });
    expect(tooLow.status).toBe(400);
  });
});

describe("admin vouchers", () => {
  it("lets an admin create, update and delete vouchers", async () => {
    const { token } = await registerUser({ isAdmin: true });
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post("/api/admin/vouchers").set(auth).send({
      code: "bridal10", type: "percent", value: 10, maxDiscount: 15000, showOnProductPage: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "BRIDAL10", discountLabel: "10% OFF", conditionLabel: "Up to ₦15,000 off" });

    const dup = await request(app).post("/api/admin/vouchers").set(auth).send({ code: "BRIDAL10", type: "fixed", value: 1000 });
    expect(dup.status).toBe(400);

    const tooBig = await request(app).post("/api/admin/vouchers").set(auth).send({ code: "HALFPLUS", type: "percent", value: 150 });
    expect(tooBig.status).toBe(400);

    const updated = await request(app).put(`/api/admin/vouchers/${created.body._id}`).set(auth).send({ active: false });
    expect(updated.body.active).toBe(false);

    const list = await request(app).get("/api/admin/vouchers").set(auth);
    expect(list.body.map((v) => v.code)).toContain("BRIDAL10");

    const del = await request(app).delete(`/api/admin/vouchers/${created.body._id}`).set(auth);
    expect(del.status).toBe(200);
  });

  it("is admin-only", async () => {
    const { token } = await registerUser();
    const res = await request(app).post("/api/admin/vouchers").set("Authorization", `Bearer ${token}`).send({ code: "FREE99", type: "percent", value: 99 });
    expect(res.status).toBe(401);
  });
});
