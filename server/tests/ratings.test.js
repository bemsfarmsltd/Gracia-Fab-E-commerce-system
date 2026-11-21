import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { recalculateAllRatings, recalculateProductRating } from "../services/ratings.js";

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(() => Promise.all([Product.deleteMany({}), Review.deleteMany({}), User.deleteMany({})]));

const base = { description: "x", image: "/p.jpg", category: "skincare", price: 5000, stock: 3 };

describe("product ratings", () => {
  it("come only from real reviews: made-up numbers are reset", async () => {
    const [fake, reviewed, honest] = await Product.create([
      { ...base, name: "Fake 4.9 from 32", rating: 4.9, numReviews: 32 },
      { ...base, name: "Two real reviews", rating: 5, numReviews: 99 },
      { ...base, name: "No reviews" },
    ]);
    const [a, b] = await User.create([
      { name: "A", email: "a@example.com", password: "password123" },
      { name: "B", email: "b@example.com", password: "password123" },
    ]);
    await Review.create([
      { product: reviewed._id, user: a._id, name: "A", rating: 5, comment: "Great" },
      { product: reviewed._id, user: b._id, name: "B", rating: 4, comment: "Good" },
    ]);

    expect(await recalculateAllRatings()).toBe(2); // fake + reviewed corrected
    const after = Object.fromEntries((await Product.find().lean()).map((p) => [p.name, [p.rating, p.numReviews]]));
    expect(after["Fake 4.9 from 32"]).toEqual([0, 0]);
    expect(after["Two real reviews"]).toEqual([4.5, 2]);
    expect(after["No reviews"]).toEqual([0, 0]);
    expect(await recalculateAllRatings()).toBe(0); // nothing left to fix
    void fake; void honest;
  });

  it("update when a review is removed", async () => {
    const p = await Product.create({ ...base, name: "P" });
    const u = await User.create({ name: "A", email: "a@example.com", password: "password123" });
    const r = await Review.create({ product: p._id, user: u._id, name: "A", rating: 3, comment: "OK" });
    expect(await recalculateProductRating(p._id)).toEqual({ rating: 3, numReviews: 1 });
    await r.deleteOne();
    expect(await recalculateProductRating(p._id)).toEqual({ rating: 0, numReviews: 0 });
  });
});
