import Product from "../models/Product.js";
import StockTake from "../models/StockTake.js";
import { changeStock } from "./stock.js";
import { findByCode } from "./barcodes.js";

export class StockTakeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function startStockTake({ name, category }, actor) {
  const existing = await StockTake.findOne({ status: "open" }).select("name").lean();
  if (existing) throw new StockTakeError(`"${existing.name}" is still open. Finish or cancel it first.`, 409);
  try {
    return await StockTake.create({ name, category: category || undefined, startedBy: actor._id, startedByName: actor.name });
  } catch (err) {
    if (err?.code === 11000) throw new StockTakeError("Another stock take was just started.", 409);
    throw err;
  }
}

async function openTake(id) {
  const take = await StockTake.findById(id).select("status category").lean();
  if (!take) throw new StockTakeError("Stock take not found", 404);
  if (take.status !== "open") throw new StockTakeError("This stock take is finished.");
  return take;
}

async function productFor(take, productId) {
  const product = await Product.findById(productId).select("name stock category").lean();
  if (!product) throw new StockTakeError("Product not found", 404);
  if (take.category && product.category !== take.category) {
    throw new StockTakeError(`"${product.name}" isn't in ${take.category}, which this count covers.`);
  }
  return product;
}

// Adds `by` to a product's count (a scan adds 1). The first time a product is
// counted, its current system count is noted.
export async function addToCount(id, productId, by, actor) {
  const take = await openTake(id);
  const product = await productFor(take, productId);
  const inc = await StockTake.findOneAndUpdate(
    { _id: id, status: "open", "lines.product": product._id },
    { $inc: { "lines.$.counted": by }, $set: { "lines.$.lastCountedBy": actor.name } },
    { new: true },
  );
  if (!inc) {
    const pushed = await StockTake.findOneAndUpdate(
      { _id: id, status: "open", "lines.product": { $ne: product._id } },
      { $push: { lines: { product: product._id, name: product.name, counted: Math.max(0, by), systemAtCount: Number(product.stock) || 0, lastCountedBy: actor.name } } },
      { new: true },
    );
    // Someone else added the line at the same moment: add to theirs.
    if (!pushed) return addToCount(id, productId, by, actor);
    return { take: pushed, product };
  }
  return { take: inc, product };
}

export async function scanIntoCount(id, code, actor) {
  const product = await findByCode(code);
  if (!product) throw new StockTakeError(`No product has the code "${String(code).trim()}".`, 404);
  return addToCount(id, product._id, 1, actor);
}

// Sets a product's count to an exact number.
export async function setCount(id, productId, counted, actor) {
  const take = await openTake(id);
  const product = await productFor(take, productId);
  const updated = await StockTake.findOneAndUpdate(
    { _id: id, status: "open", "lines.product": product._id },
    { $set: { "lines.$.counted": counted, "lines.$.lastCountedBy": actor.name } },
    { new: true },
  );
  if (updated) return { take: updated, product };
  const pushed = await StockTake.findOneAndUpdate(
    { _id: id, status: "open", "lines.product": { $ne: product._id } },
    { $push: { lines: { product: product._id, name: product.name, counted, systemAtCount: Number(product.stock) || 0, lastCountedBy: actor.name } } },
    { new: true },
  );
  return pushed ? { take: pushed, product } : setCount(id, productId, counted, actor);
}

export async function removeLine(id, productId) {
  await openTake(id);
  return StockTake.findOneAndUpdate({ _id: id, status: "open" }, { $pull: { lines: { product: productId } } }, { new: true });
}

// The differences the owner will approve, and which products nobody counted.
export async function preview(take) {
  const filter = take.category ? { category: take.category } : {};
  const products = await Product.find(filter).select("name stock category").sort({ name: 1 }).lean();
  const counted = new Set(take.lines.map((l) => String(l.product)));
  const lines = take.lines.map((l) => ({
    product: l.product, name: l.name, counted: l.counted, systemAtCount: l.systemAtCount,
    difference: l.counted - l.systemAtCount, lastCountedBy: l.lastCountedBy,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const uncounted = products.filter((p) => !counted.has(String(p._id))).map((p) => ({ product: p._id, name: p.name, stock: Number(p.stock) || 0 }));
  return {
    lines,
    uncounted,
    totals: {
      counted: lines.length,
      missingUnits: lines.reduce((t, l) => t + (l.difference < 0 ? -l.difference : 0), 0),
      extraUnits: lines.reduce((t, l) => t + (l.difference > 0 ? l.difference : 0), 0),
      uncounted: uncounted.length,
      uncountedUnits: uncounted.reduce((t, p) => t + p.stock, 0),
    },
  };
}

// Owner: apply the differences as "count" movements. With zeroUncounted,
// products nobody counted are set to 0 (a full count: not found = not there).
export async function completeStockTake(id, { zeroUncounted = false }, actor) {
  const take = await StockTake.findOneAndUpdate({ _id: id, status: "open" }, { $set: { status: "completed" } }, { new: true });
  if (!take) {
    const exists = await StockTake.exists({ _id: id });
    throw new StockTakeError(exists ? "This stock take is already finished." : "Stock take not found", exists ? 400 : 404);
  }
  const note = `Stock take "${take.name}"`;
  const results = [];
  for (const l of take.lines) {
    const difference = l.counted - l.systemAtCount;
    if (difference === 0) {
      const p = await Product.findById(l.product).select("stock").lean();
      results.push({ product: l.product, name: l.name, counted: l.counted, systemAtCount: l.systemAtCount, difference: 0, stockAfter: Number(p?.stock) || 0 });
      continue;
    }
    let applied = difference;
    let r = await changeStock({ productId: l.product, change: difference, reason: "count", note, actor });
    let extra;
    if (!r && difference < 0) {
      // More sold since counting than the shelf now holds: go to 0 at most.
      const p = await Product.findById(l.product).select("stock").lean();
      const now = Number(p?.stock) || 0;
      applied = -now;
      r = now > 0 ? await changeStock({ productId: l.product, change: -now, reason: "count", note, actor }) : { product: { stock: 0 } };
      extra = `Only ${now} left to remove (sales since counting)`;
    }
    results.push({ product: l.product, name: l.name, counted: l.counted, systemAtCount: l.systemAtCount, difference: applied, stockAfter: r?.product?.stock ?? null, note: extra });
  }
  if (zeroUncounted) {
    const { uncounted } = await preview(take);
    for (const u of uncounted) {
      if (u.stock <= 0) continue;
      const r = await changeStock({ productId: u.product, change: -u.stock, reason: "count", note: `${note}: not found`, actor });
      results.push({ product: u.product, name: u.name, counted: null, systemAtCount: u.stock, difference: r ? -u.stock : 0, stockAfter: r?.product?.stock ?? null, note: "Not counted: set to 0" });
    }
  }
  take.results = results;
  take.completedAt = new Date();
  take.completedByName = actor.name;
  take.zeroedUncounted = Boolean(zeroUncounted);
  take.totals = {
    products: results.length,
    missingUnits: results.reduce((t, x) => t + (x.difference < 0 ? -x.difference : 0), 0),
    extraUnits: results.reduce((t, x) => t + (x.difference > 0 ? x.difference : 0), 0),
    unchanged: results.filter((x) => x.difference === 0).length,
  };
  await take.save();
  return take;
}

export async function cancelStockTake(id) {
  const take = await StockTake.findOneAndUpdate({ _id: id, status: "open" }, { $set: { status: "cancelled", completedAt: new Date() } }, { new: true });
  if (!take) throw new StockTakeError("Only an open stock take can be cancelled.");
  return take;
}
