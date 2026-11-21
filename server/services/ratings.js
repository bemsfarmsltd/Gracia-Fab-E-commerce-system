import mongoose from "mongoose";
import Product from "../models/Product.js";
import Review from "../models/Review.js";

// A product's rating and review count come only from real customer reviews
// (the Review collection). Called when a review is added or deleted, and for
// every product when the server starts, which also clears any made-up numbers
// that were typed into the catalogue.

const round1 = (n) => Math.round(n * 10) / 10;

export async function recalculateProductRating(productId) {
  const id = new mongoose.Types.ObjectId(String(productId));
  const [stats] = await Review.aggregate([
    { $match: { product: id } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const rating = stats ? round1(stats.avg) : 0;
  const numReviews = stats ? stats.count : 0;
  await Product.updateOne({ _id: id }, { $set: { rating, numReviews } });
  return { rating, numReviews };
}

// Returns how many products had to be corrected.
export async function recalculateAllRatings() {
  const stats = await Review.aggregate([
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const real = new Map(stats.map((s) => [String(s._id), { rating: round1(s.avg), numReviews: s.count }]));
  const products = await Product.find({}).select("rating numReviews").lean();
  const ops = [];
  for (const p of products) {
    const want = real.get(String(p._id)) || { rating: 0, numReviews: 0 };
    if ((p.rating || 0) !== want.rating || (p.numReviews || 0) !== want.numReviews) {
      ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: want } } });
    }
  }
  if (ops.length) await Product.bulkWrite(ops);
  return ops.length;
}
