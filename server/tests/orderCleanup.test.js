import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { expireUnpaidOrders, EXPIRY_REASON } from "../services/orderCleanup.js";
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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
  fetch.mockReset();
  _resetMonnifyTokenCache();
});

const deliveryAddress = { fullName: "Ada Buyer", phone: "08030000000", address: "1 St", city: "Lagos", state: "Lagos" };
const HOUR = 60 * 60 * 1000;

function mockMonnify(paymentStatus, amountPaid) {
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
              paymentStatus,
              amountPaid: String(amountPaid),
              customer: { email: "buyer@example.com" },
            },
          },
  }));
}

let buyer;
let product;

// Places an order through the API, optionally starts a payment, and backdates it.
async function placeOrder({ hoursAgo, startPayment = false }) {
  if (!buyer) {
    buyer = (await request(app).post("/api/auth/register").send({ name: "Ada", email: "buyer@example.com", password: "password123" })).body.token;
  }
  if (!product || !(await Product.exists({ _id: product._id }))) {
    product = await Product.create({ name: "Serum", description: "d", price: 9000, image: "https://example.com/s.jpg", category: "skincare", stock: 5 });
  }
  const order = (await request(app).post("/api/orders").set("Authorization", `Bearer ${buyer}`)
    .send({ orderItems: [{ product: product._id, quantity: 1 }], deliveryAddress })).body;
  if (startPayment) {
    await request(app).post(`/api/orders/${order._id}/pay/init`).set("Authorization", `Bearer ${buyer}`);
  }
  await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(order._id) }, { $set: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } });
  return Order.findById(order._id);
}

describe("unpaid-order cleanup", () => {
  beforeEach(() => { buyer = undefined; product = undefined; });

  it("cancels unpaid orders older than 48 hours and leaves newer ones", async () => {
    const old = await placeOrder({ hoursAgo: 49 });
    const recent = await placeOrder({ hoursAgo: 47 });

    const result = await expireUnpaidOrders();

    expect(result).toEqual({ cancelled: 1, paid: 0, skipped: 0 });
    const cancelled = await Order.findById(old._id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(EXPIRY_REASON);
    expect(cancelled.refund.status).toBe("none");
    expect(cancelled.statusHistory.at(-1).note).toMatch(/automatically/);
    expect((await Order.findById(recent._id)).status).toBe("pending");
    // Stock is never held for unpaid orders, so nothing changes.
    expect((await Product.findById(product._id)).stock).toBe(5);
    // Nobody is messaged and Monnify isn't asked when no payment was started.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("marks an order paid instead if Monnify says the customer did pay", async () => {
    const order = await placeOrder({ hoursAgo: 72, startPayment: true });
    mockMonnify("PAID", order.totalPrice);

    const result = await expireUnpaidOrders();

    expect(result).toEqual({ cancelled: 0, paid: 1, skipped: 0 });
    const after = await Order.findById(order._id);
    expect(after.isPaid).toBe(true);
    expect(after.status).toBe("processing");
    expect((await Product.findById(product._id)).stock).toBe(4);
  });

  it("cancels a started-but-abandoned payment", async () => {
    const order = await placeOrder({ hoursAgo: 72, startPayment: true });
    mockMonnify("PENDING", 0);

    expect(await expireUnpaidOrders()).toEqual({ cancelled: 1, paid: 0, skipped: 0 });
    expect((await Order.findById(order._id)).status).toBe("cancelled");
  });

  it("leaves the order for the next run if Monnify can't be reached", async () => {
    const order = await placeOrder({ hoursAgo: 72, startPayment: true });
    fetch.mockRejectedValue(new Error("network down"));

    expect(await expireUnpaidOrders()).toEqual({ cancelled: 0, paid: 0, skipped: 1 });
    expect((await Order.findById(order._id)).status).toBe("pending");
  });

  it("never touches paid or already-moving orders", async () => {
    const order = await placeOrder({ hoursAgo: 100, startPayment: true });
    mockMonnify("PAID", order.totalPrice);
    await request(app).put(`/api/orders/${order._id}/pay`).set("Authorization", `Bearer ${buyer}`).send({});
    fetch.mockReset();

    expect(await expireUnpaidOrders()).toEqual({ cancelled: 0, paid: 0, skipped: 0 });
    expect((await Order.findById(order._id)).status).toBe("processing");
  });
});
