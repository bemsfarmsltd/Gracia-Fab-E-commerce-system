import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import logger from "../utils/logger.js";

// The only way stock counts change. Every change updates the product's count
// atomically (it can never go below 0) and records a StockMovement with the
// balance after, so a product's history always adds up to its stock.

export class StockError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const who = (actor) => (actor ? { actor: actor._id, actorName: actor.name } : {});

// The first time a product gets a movement, record what it held before
// history began, so its movements add up from the start.
async function ensureOpening(product, balanceBefore, at) {
  const exists = await StockMovement.exists({ product: product._id });
  if (exists) return;
  await StockMovement.create({
    product: product._id,
    productName: product.name,
    change: balanceBefore,
    balanceAfter: balanceBefore,
    reason: "opening",
    createdAt: new Date(at.getTime() - 1),
  });
}

async function record(product, { change, reason, order, sale, note, actor }) {
  const now = new Date();
  try {
    await ensureOpening(product, product.stock - change, now);
    return await StockMovement.create({
      product: product._id,
      productName: product.name,
      change,
      balanceAfter: product.stock,
      reason,
      order,
      sale,
      note,
      ...who(actor),
      createdAt: now,
    });
  } catch (err) {
    // The count itself already changed; don't undo a sale over a log write.
    logger.error({ err, product: product._id, change, reason }, "Couldn't record a stock movement");
    return null;
  }
}

// Add (change > 0) or take (change < 0) stock. Taking more than is there is
// refused (returns null), never taken below 0.
export async function changeStock({ productId, change, reason, order, sale, note, actor }) {
  if (!Number.isInteger(change) || change === 0) throw new StockError("Change must be a whole number, not 0");
  const filter = { _id: productId };
  if (change < 0) filter.stock = { $gte: -change };
  const newStock = { $add: [{ $ifNull: ["$stock", 0] }, change] };
  const product = await Product.findOneAndUpdate(
    filter,
    [{ $set: { stock: newStock, isInStock: { $gt: [newStock, 0] } } }],
    { new: true },
  );
  if (!product) return null;
  const movement = await record(product, { change, reason, order, sale, note, actor });
  return { product, movement };
}

// Set the count to what was counted. Retries if someone else changed the
// count at the same moment (e.g. an online sale during a stock take).
export async function setStockCount({ productId, count, reason = "count", note, actor }) {
  if (!Number.isInteger(count) || count < 0) throw new StockError("Count must be a whole number, 0 or more");
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await Product.findById(productId).select("name stock").lean();
    if (!current) return null;
    const before = Number(current.stock) || 0;
    if (before === count) return { product: current, movement: null, before, unchanged: true };
    const product = await Product.findOneAndUpdate(
      { _id: productId, stock: current.stock ?? null },
      { $set: { stock: count, isInStock: count > 0 } },
      { new: true },
    );
    if (!product) continue; // changed underneath us: read again
    const movement = await record(product, { change: count - before, reason, note, actor });
    return { product, movement, before };
  }
  throw new StockError("The stock count kept changing while saving. Please try again.", 409);
}

// A brand-new product's starting stock.
export async function recordInitialStock(product, actor) {
  await StockMovement.create({
    product: product._id,
    productName: product.name,
    change: Number(product.stock) || 0,
    balanceAfter: Number(product.stock) || 0,
    reason: "initial",
    ...who(actor),
  }).catch((err) => logger.error({ err, product: product._id }, "Couldn't record initial stock"));
}

// Do the product's movements add up to its count? (They always should; a
// mismatch means a change bypassed this service.)
export async function reconcile(productId) {
  const [product, sums] = await Promise.all([
    Product.findById(productId).select("stock").lean(),
    StockMovement.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
      { $group: { _id: null, total: { $sum: "$change" }, count: { $sum: 1 } } },
    ]),
  ]);
  if (!product) return null;
  const stock = Number(product.stock) || 0;
  const movements = sums[0]?.count || 0;
  const total = sums[0]?.total ?? 0;
  // No history yet: nothing to disagree with.
  return { stock, movementsTotal: movements ? total : stock, movements, matches: movements === 0 || total === stock };
}
