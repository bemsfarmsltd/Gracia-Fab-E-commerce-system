import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

let mongod;
const DAY = 24 * 60 * 60 * 1000;

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

async function register(email, name = "Adaeze Okafor") {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "password123" });
  return { Authorization: `Bearer ${res.body.token}` };
}

const base = { description: "x", image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/p.jpg", brand: "Test" };
const make = (o) => Product.create({ ...base, price: 8000, stock: 10, ...o });

describe("My Vanity", () => {
  it("is only for logged-in customers", async () => {
    expect((await request(app).get("/api/vanity")).status).toBe(401);
    expect((await request(app).put("/api/vanity/profile").send({ skinType: "dry" })).status).toBe(401);
    expect((await request(app).delete("/api/vanity/profile")).status).toBe(401);
  });

  it("starts empty for a new customer and only offers in-stock products, labelled as new", async () => {
    const me = await register("new@example.com");
    await make({ name: "In stock serum", category: "skincare" });
    await make({ name: "Sold out serum", category: "skincare", stock: 0 });

    const res = await request(app).get("/api/vanity").set(me);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.body.firstName).toBe("Adaeze");
    expect(res.body.profile.skinType).toBeNull();
    expect(res.body.completeness).toMatchObject({ done: 0, total: 5 });
    expect(res.body.picks.basis).toBe("new");
    expect(res.body.picks.items.map((p) => p.name)).toEqual(["In stock serum"]);
    expect(res.body.picks.items[0].reasons).toEqual(["New in store"]);
    expect(res.body.activeOrders).toEqual([]);
    expect(res.body.loyalty).toMatchObject({ points: 0, tier: "bronze", nextTier: "silver", pointsToNext: 500 });
  });

  it("saves, validates and clears the beauty profile", async () => {
    const me = await register("p@example.com");
    const ok = await request(app).put("/api/vanity/profile").set(me)
      .send({ skinType: "dry", skinConcerns: ["dark-spots", "dark-spots"], shoppingFor: ["skincare"], undertone: "Warm Golden / Caramel" });
    expect(ok.status).toBe(200);
    expect(ok.body.profile).toMatchObject({ skinType: "dry", skinConcerns: ["dark-spots"], undertone: "Warm Golden / Caramel" });
    expect(ok.body.completeness.done).toBe(4);

    expect((await request(app).put("/api/vanity/profile").set(me).send({ skinType: "purple" })).status).toBe(400);
    expect((await request(app).put("/api/vanity/profile").set(me).send({ isAdmin: true })).status).toBe(400);
    expect((await User.findOne({ email: "p@example.com" })).isAdmin).toBe(false);

    const cleared = await request(app).put("/api/vanity/profile").set(me).send({ skinType: null, skinConcerns: [] });
    expect(cleared.body.profile).toMatchObject({ skinType: null, skinConcerns: [], undertone: "Warm Golden / Caramel" });

    const wiped = await request(app).delete("/api/vanity/profile").set(me);
    expect(wiped.body.completeness.done).toBe(0);
    expect((await User.findOne({ email: "p@example.com" }).lean()).beautyProfile).toBeUndefined();
  });

  it("picks products that match the profile, with the real reason, and leaves out sold-out and wishlisted ones", async () => {
    const me = await register("m@example.com");
    const match = await make({ name: "Dry skin spot serum", category: "skincare", suitableFor: { skinType: ["dry"], concern: ["dark spots"] } });
    await make({ name: "Oily skin gel", category: "skincare", suitableFor: { skinType: ["oily"], concern: ["acne"] } });
    await make({ name: "Sold out dry cream", category: "skincare", stock: 0, suitableFor: { skinType: ["dry"] } });
    const wished = await make({ name: "Wishlisted dry balm", category: "skincare", suitableFor: { skinType: ["dry"] } });
    await User.updateOne({ email: "m@example.com" }, { wishlist: [wished._id] });

    await request(app).put("/api/vanity/profile").set(me).send({ skinType: "dry", skinConcerns: ["dark-spots"] });
    const res = await request(app).get("/api/vanity").set(me);

    expect(res.body.picks.basis).toBe("profile");
    expect(res.body.picks.items.map((p) => p.name)).toEqual(["Dry skin spot serum"]);
    expect(res.body.picks.items[0]._id).toBe(String(match._id));
    expect(res.body.picks.items[0].reasons).toEqual(["Suits dry skin", "Targets dark spots & uneven tone"]);
    expect(res.body.wishlist).toMatchObject({ count: 1 });
    expect(res.body.wishlist.items[0].name).toBe("Wishlisted dry balm");
  });

  it("shows orders on their way and suggests restocking what ran out, never another customer's", async () => {
    const me = await register("o@example.com");
    const other = await register("other@example.com");
    const meId = (await User.findOne({ email: "o@example.com" }))._id;
    const otherId = (await User.findOne({ email: "other@example.com" }))._id;
    const serum = await make({ name: "Glow serum", category: "skincare" });
    const wig = await make({ name: "Bob wig", category: "wig", price: 90000 });
    const fresh = await make({ name: "Fresh toner", category: "skincare" });

    const item = (p) => ({ name: p.name, quantity: 1, price: p.price, product: p._id, image: p.image });
    const addr = { fullName: "A", phone: "0803", address: "1 St", city: "Umuahia", state: "Abia" };
    const order = (user, p, o) => ({ user, orderItems: [item(p)], deliveryAddress: addr, itemsPrice: p.price, deliveryPrice: 2500, totalPrice: p.price + 2500, ...o });
    const fiftyDaysAgo = new Date(Date.now() - 50 * DAY);
    await Order.create([
      order(meId, serum, { isPaid: true, paidAt: fiftyDaysAgo, status: "delivered", createdAt: fiftyDaysAgo }),
      order(meId, wig, { isPaid: true, paidAt: fiftyDaysAgo, status: "delivered", createdAt: fiftyDaysAgo }),
      order(meId, fresh, { isPaid: true, paidAt: new Date(), status: "shipped" }),
      order(meId, fresh, { status: "cancelled" }),
      order(otherId, serum, { isPaid: true, paidAt: new Date(), status: "processing" }),
    ]);

    const res = await request(app).get("/api/vanity").set(me);
    expect(res.body.activeOrders).toHaveLength(1);
    expect(res.body.activeOrders[0]).toMatchObject({ status: "shipped", itemCount: 1 });
    // Skincare bought 50 days ago is due; wigs aren't "used up".
    expect(res.body.restock.map((p) => p.name)).toEqual(["Glow serum"]);
    // Just bought: not suggested again.
    expect(res.body.picks.items.map((p) => p.name)).not.toContain("Fresh toner");

    const theirs = await request(app).get("/api/vanity").set(other);
    expect(theirs.body.activeOrders).toHaveLength(1);
    expect(theirs.body.activeOrders[0].status).toBe("processing");
    expect(theirs.body.restock).toEqual([]);
  });
});
