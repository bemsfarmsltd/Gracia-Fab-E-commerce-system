#!/usr/bin/env node
/* eslint-disable no-console */
// Records today's count as the "opening balance" for every product that has
// no stock history yet, so the history starts from one known point.
// Safe to run more than once: products that already have history are skipped.
//
//   cd server && npm run stock:opening
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

await mongoose.connect(process.env.MONGO_URI);
const withHistory = new Set((await StockMovement.distinct("product")).map(String));
const products = await Product.find({}).select("name stock").lean();
const missing = products.filter((p) => !withHistory.has(String(p._id)));

if (missing.length) {
  await StockMovement.insertMany(missing.map((p) => ({
    product: p._id,
    productName: p.name,
    change: Number(p.stock) || 0,
    balanceAfter: Number(p.stock) || 0,
    reason: "opening",
    note: "Count when stock history started",
  })));
}
console.log(`${missing.length} product(s) given an opening balance; ${products.length - missing.length} already had history.`);
await mongoose.disconnect();
