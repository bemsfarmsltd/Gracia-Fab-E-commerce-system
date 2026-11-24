import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { copyDatabase, verifyCopy } from "../scripts/lib/copyMongo.js";

let mongod;
let source;
let target;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  source = await mongoose.createConnection(mongod.getUri("old-store")).asPromise();
  target = await mongoose.createConnection(mongod.getUri("company-store")).asPromise();
}, 120000);

afterAll(async () => {
  await source.close();
  await target.close();
  await mongod.stop();
});

beforeEach(async () => {
  await source.db.dropDatabase();
  await target.db.dropDatabase();
});

async function seed() {
  const users = source.db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  const { insertedIds } = await users.insertMany([
    { name: "Admin", email: "admin@example.com", isAdmin: true, loyaltyPoints: 0 },
    { name: "Ada", email: "ada@example.com", loyaltyPoints: 120, beautyProfile: { skinConcerns: ["acne"] } },
  ]);
  await source.db.collection("products").insertMany(
    Array.from({ length: 2500 }, (_, i) => ({ name: `P${i}`, price: 1000 + i, stock: i % 3, createdAt: new Date() })),
  );
  await source.db.collection("orders").insertMany([
    { user: insertedIds[1], totalPrice: 10000, isPaid: true, status: "paid", orderItems: [{ name: "P1", quantity: 1 }] },
    { user: insertedIds[1], totalPrice: 5000, isPaid: false, status: "pending" },
  ]);
  await source.db.createCollection("subscribers"); // empty collections come across too
}

describe("copying to the company MongoDB account", () => {
  it("copies every collection, document and index, and proves it", async () => {
    await seed();
    const names = await copyDatabase(source.db, target.db);
    expect(names).toEqual(["orders", "products", "subscribers", "users"]);

    const { differences, totals } = await verifyCopy(source.db, target.db);
    expect(differences).toEqual([]);
    expect(totals).toEqual({ paidRevenue: 10000, totalStock: 2499, loyaltyPoints: 120, admins: 1 });

    // Ids, dates and nested data survive exactly.
    const ada = await target.db.collection("users").findOne({ email: "ada@example.com" });
    const original = await source.db.collection("users").findOne({ email: "ada@example.com" });
    expect(ada).toEqual(original);
    const order = await target.db.collection("orders").findOne({ isPaid: true });
    expect(order.user).toBeInstanceOf(mongoose.mongo.ObjectId);

    // The unique email rule came across.
    await expect(target.db.collection("users").insertOne({ email: "ada@example.com" })).rejects.toThrow(/duplicate key/);
  }, 60000);

  it("never leaves the old database changed", async () => {
    await seed();
    const before = await source.db.collection("products").countDocuments();
    await copyDatabase(source.db, target.db);
    expect(await source.db.collection("products").countDocuments()).toBe(before);
    expect(await source.db.collection("users").countDocuments()).toBe(2);
  }, 60000);

  it("refuses to copy into a database that already has data, unless told to replace it", async () => {
    await seed();
    await target.db.collection("users").insertOne({ email: "someone@example.com" });
    await expect(copyDatabase(source.db, target.db)).rejects.toThrow(/already has data/);
    expect(await target.db.collection("products").countDocuments()).toBe(0);

    await copyDatabase(source.db, target.db, { replace: true });
    expect((await verifyCopy(source.db, target.db)).differences).toEqual([]);
  }, 60000);

  it("spots a missing document even when the counts match", async () => {
    await seed();
    await copyDatabase(source.db, target.db);
    const one = await target.db.collection("orders").findOne({ isPaid: false });
    await target.db.collection("orders").deleteOne({ _id: one._id });
    await target.db.collection("orders").insertOne({ totalPrice: 5000, isPaid: false, status: "pending" });
    const { differences } = await verifyCopy(source.db, target.db);
    expect(differences.join()).toMatch(/orders: same count but different documents/);
  }, 60000);
});
