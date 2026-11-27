import mongoose from "mongoose";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import Order from "../models/Order.js";
import StoreSale from "../models/StoreSale.js";
import StockMovement from "../models/StockMovement.js";
import { changeStock } from "./stock.js";

export class CostingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Average cost of what's on the shelf after a delivery: the old units at the
// old average plus the new units at their price. With no cost yet, the new
// price is the cost.
export function averageCost({ stockBefore, costBefore, quantity, unitCost }) {
  if (costBefore === undefined || costBefore === null || stockBefore <= 0) return unitCost;
  return Math.round((stockBefore * costBefore + quantity * unitCost) / (stockBefore + quantity));
}

// Records a supplier delivery: stock goes up ("received", with the unit
// cost), each product's average and last cost update, and products without
// a supplier get this one.
export async function receivePurchase({ supplierId, items, invoiceRef, note, receivedAt }, actor) {
  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) throw new CostingError("Choose a supplier", 404);

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).select("name stock +costPrice +supplier").lean();
  if (products.length !== ids.length) throw new CostingError("A product in this delivery no longer exists");
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const purchase = new Purchase({
    supplier: supplier._id,
    supplierName: supplier.name,
    items: [],
    total: 0,
    invoiceRef: invoiceRef || undefined,
    note: note || undefined,
    receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    receivedBy: actor._id,
    receivedByName: actor.name,
  });

  for (const item of items) {
    const p = byId.get(item.productId);
    const result = await changeStock({
      productId: p._id, change: item.quantity, reason: "received", purchase: purchase._id, actor,
      unitCost: item.unitCost, note: `From ${supplier.name}${invoiceRef ? `, invoice ${invoiceRef}` : ""}`,
    });
    const stockBefore = result.product.stock - item.quantity;
    const costBefore = p.costPrice;
    const costAfter = averageCost({ stockBefore, costBefore, quantity: item.quantity, unitCost: item.unitCost });
    await Product.updateOne(
      { _id: p._id },
      { $set: { costPrice: costAfter, lastCost: item.unitCost, ...(p.supplier ? {} : { supplier: supplier._id }) } },
    );
    p.costPrice = costAfter; // a second line for the same product averages on top
    purchase.items.push({ product: p._id, name: p.name, quantity: item.quantity, unitCost: item.unitCost, lineTotal: item.quantity * item.unitCost, costBefore, costAfter });
  }
  purchase.total = purchase.items.reduce((t, l) => t + l.lineTotal, 0);
  await purchase.save();
  return purchase;
}

// Owner sets a product's cost, supplier and reorder level by hand (e.g. the
// costs of stock already on the shelf before deliveries were recorded).
export async function setCosting(productId, { costPrice, supplierId, reorderLevel }) {
  const set = {};
  const unset = {};
  if (costPrice !== undefined) costPrice === null ? (unset.costPrice = 1) : (set.costPrice = costPrice);
  if (supplierId !== undefined) {
    if (supplierId === null) unset.supplier = 1;
    else {
      if (!(await Supplier.exists({ _id: supplierId }))) throw new CostingError("Supplier not found", 404);
      set.supplier = supplierId;
    }
  }
  if (reorderLevel !== undefined) reorderLevel === null ? (unset.reorderLevel = 1) : (set.reorderLevel = reorderLevel);
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  const product = await Product.findByIdAndUpdate(productId, update, { new: true })
    .select("name price stock +costPrice +lastCost +supplier reorderLevel").populate("supplier", "name").lean();
  if (!product) throw new CostingError("Product not found", 404);
  return product;
}

const marginOf = (price, cost) => (cost === undefined || cost === null || !price ? null : Math.round(((price - cost) / price) * 1000) / 10);

// Every product with its cost, margin, stock value and supplier.
export async function productsWithCosts() {
  const products = await Product.find({})
    .select("name price stock sku category +costPrice +lastCost +supplier reorderLevel")
    .populate("supplier", "name").sort({ name: 1 }).lean();
  const rows = products.map((p) => ({
    _id: p._id, name: p.name, sku: p.sku, category: p.category, price: p.price, stock: Number(p.stock) || 0,
    costPrice: p.costPrice ?? null, lastCost: p.lastCost ?? null,
    margin: marginOf(p.price, p.costPrice),
    stockValue: p.costPrice != null ? (Number(p.stock) || 0) * p.costPrice : null,
    supplier: p.supplier ? { _id: p.supplier._id, name: p.supplier.name } : null,
    reorderLevel: p.reorderLevel ?? null,
    needsReorder: p.reorderLevel != null && (Number(p.stock) || 0) <= p.reorderLevel,
  }));
  return {
    products: rows,
    totals: {
      stockValue: rows.reduce((t, r) => t + (r.stockValue || 0), 0),
      retailValue: rows.reduce((t, r) => t + r.stock * r.price, 0),
      withoutCost: rows.filter((r) => r.costPrice === null && r.stock > 0).length,
    },
  };
}

// Products at or below their reorder level, grouped by supplier.
export async function reorderList() {
  const { products } = await productsWithCosts();
  const due = products.filter((p) => p.needsReorder);
  const groups = new Map();
  for (const p of due) {
    const key = p.supplier ? String(p.supplier._id) : "none";
    if (!groups.has(key)) groups.set(key, { supplier: p.supplier, products: [] });
    groups.get(key).products.push({
      _id: p._id, name: p.name, sku: p.sku, stock: p.stock, reorderLevel: p.reorderLevel, lastCost: p.lastCost,
    });
  }
  return [...groups.values()].sort((a, b) => (a.supplier?.name || "~").localeCompare(b.supplier?.name || "~"));
}

const SALE_OUT = ["online_sale", "store_sale"];
const SALE_BACK = ["online_cancel", "store_void"];

// Profit for a period, online and shop together, from the stock movements:
// each sale carries the price it sold at and the product's cost at that
// moment, so later price or cost changes don't rewrite the past.
export async function profitReport({ from, to }) {
  const match = { createdAt: { $gte: from, $lte: to }, reason: { $in: [...SALE_OUT, ...SALE_BACK] } };
  const rows = await StockMovement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$product",
        name: { $last: "$productName" },
        units: { $sum: { $multiply: ["$change", -1] } },
        revenue: { $sum: { $multiply: ["$change", -1, { $ifNull: ["$unitPrice", 0] }] } },
        cost: { $sum: { $multiply: ["$change", -1, { $ifNull: ["$unitCost", 0] }] } },
        unitsWithoutCost: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$unitCost", null] }, null] }, { $multiply: ["$change", -1] }, 0] } },
        onlineUnits: { $sum: { $cond: [{ $in: ["$reason", ["online_sale", "online_cancel"]] }, { $multiply: ["$change", -1] }, 0] } },
        shopUnits: { $sum: { $cond: [{ $in: ["$reason", ["store_sale", "store_void"]] }, { $multiply: ["$change", -1] }, 0] } },
      },
    },
    { $match: { units: { $ne: 0 } } },
  ]);
  const products = rows.map((r) => {
    const profit = r.revenue - r.cost;
    return {
      product: r._id, name: r.name, units: r.units, onlineUnits: r.onlineUnits, shopUnits: r.shopUnits,
      revenue: r.revenue, cost: r.cost, profit, unitsWithoutCost: r.unitsWithoutCost,
      margin: r.revenue && !r.unitsWithoutCost ? Math.round((profit / r.revenue) * 1000) / 10 : null,
    };
  }).sort((a, b) => b.profit - a.profit);

  // Discounts are given on whole orders/sales, not per product.
  const [orderDiscounts, shopDiscounts] = await Promise.all([
    Order.aggregate([{ $match: { isPaid: true, status: { $ne: "cancelled" }, paidAt: { $gte: from, $lte: to } } }, { $group: { _id: null, d: { $sum: "$discount" } } }]),
    StoreSale.aggregate([{ $match: { status: "completed", createdAt: { $gte: from, $lte: to } } }, { $group: { _id: null, d: { $sum: "$discount" } } }]),
  ]);
  const discounts = (orderDiscounts[0]?.d || 0) + (shopDiscounts[0]?.d || 0);
  const revenue = products.reduce((t, p) => t + p.revenue, 0);
  const cost = products.reduce((t, p) => t + p.cost, 0);
  return {
    from, to, products,
    totals: {
      units: products.reduce((t, p) => t + p.units, 0),
      revenue, discounts, netRevenue: revenue - discounts, cost,
      profit: revenue - discounts - cost,
      margin: revenue - discounts ? Math.round(((revenue - discounts - cost) / (revenue - discounts)) * 1000) / 10 : null,
      unitsWithoutCost: products.reduce((t, p) => t + p.unitsWithoutCost, 0),
    },
  };
}

export const isObjectId = (v) => typeof v === "string" && mongoose.isValidObjectId(v) && /^[0-9a-f]{24}$/.test(v);
