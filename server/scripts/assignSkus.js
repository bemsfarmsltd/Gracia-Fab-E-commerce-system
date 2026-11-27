#!/usr/bin/env node
/* eslint-disable no-console */
// Gives every product that hasn't got one a shop code (GF-000001, …) in the
// order they were added; products without a barcode use it as their barcode.
// Safe to run more than once.
//
//   cd server && npm run products:assign-skus
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import { assignSku } from "../services/barcodes.js";

await mongoose.connect(process.env.MONGO_URI);
// Only adds missing indexes (never drops any).
await Product.createIndexes();
const missing = await Product.find({ sku: { $exists: false } }).sort({ createdAt: 1, _id: 1 }).select("_id").lean();
for (const { _id } of missing) await assignSku(_id);
console.log(`${missing.length} product(s) given a shop code.`);
await mongoose.disconnect();
