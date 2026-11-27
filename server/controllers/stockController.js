import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement, { STOCK_REASONS } from "../models/StockMovement.js";
import { changeStock, reconcile, StockError } from "../services/stock.js";
import { MANUAL_OUT } from "../validators/stockValidators.js";
import { sendServerError } from "../utils/httpErrors.js";

const isId = (v) => typeof v === "string" && /^[0-9a-f]{24}$/.test(v);
const shortOrder = (id) => (id ? String(id).slice(-8).toUpperCase() : undefined);

const view = (m) => ({
  _id: m._id,
  product: m.product,
  productName: m.productName,
  change: m.change,
  balanceAfter: m.balanceAfter,
  reason: m.reason,
  reasonLabel: STOCK_REASONS[m.reason] || m.reason,
  order: m.order || null,
  orderNumber: shortOrder(m.order),
  note: m.note || "",
  actorName: m.actorName || (m.reason === "online_sale" ? "Customer payment" : m.reason === "opening" ? "" : "System"),
  createdAt: m.createdAt,
});

// @desc   Record a delivery, a customer return, or a write-off (damaged,
//         expired, lost), or a correction
// @route  POST /api/admin/stock/movements   { productId, reason, quantity, note? }
export const postMovement = async (req, res) => {
  try {
    const { productId, reason, quantity, note } = req.body;
    const change = MANUAL_OUT.includes(reason) ? -Math.abs(quantity) : reason === "correction" ? quantity : Math.abs(quantity);
    const result = await changeStock({ productId, change, reason, note, actor: req.user });
    if (!result) {
      const product = await Product.findById(productId).select("name stock").lean();
      if (!product) return res.status(404).json({ message: "Product not found" });
      return res.status(400).json({ message: `Only ${product.stock ?? 0} of "${product.name}" in stock, so ${Math.abs(change)} can't be taken off.` });
    }
    const { product, movement } = result;
    res.locals.activity = {
      targetType: "product",
      targetId: String(product._id),
      summary: `${STOCK_REASONS[reason]}: "${product.name}" ${change > 0 ? "+" : ""}${change} → ${product.stock} in stock${note ? ` (${note})` : ""}`,
      changes: { stock: { from: product.stock - change, to: product.stock }, reason },
    };
    res.status(201).json({ stock: product.stock, movement: movement ? view(movement) : null });
  } catch (error) {
    if (error instanceof StockError) return res.status(error.status).json({ message: error.message });
    return sendServerError(res, error, "postMovement error");
  }
};

// @desc   Stock history, newest first
// @route  GET /api/admin/stock/movements?product=&reason=&from=YYYY-MM-DD&to=&page=&limit=
//   reason: one reason, or "in" / "out" for all increases / decreases
export const getMovements = async (req, res) => {
  try {
    const { product, reason, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (product) {
      if (!isId(product)) return res.status(400).json({ message: "Invalid product" });
      filter.product = new mongoose.Types.ObjectId(product);
    }
    if (reason === "in") filter.change = { $gt: 0 };
    else if (reason === "out") filter.change = { $lt: 0 };
    else if (reason && STOCK_REASONS[reason]) filter.reason = reason;
    const range = {};
    if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(new Date(to).getTime() + 86400000 - 1);
    if (Object.keys(range).length) filter.createdAt = range;

    const [items, total] = await Promise.all([
      StockMovement.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StockMovement.countDocuments(filter),
    ]);
    const body = { items: items.map(view), total, page, pages: Math.max(1, Math.ceil(total / limit)), reasons: STOCK_REASONS };
    // For one product: its current count and whether the history adds up.
    if (filter.product) body.reconciliation = await reconcile(product);
    res.json(body);
  } catch (error) {
    return sendServerError(res, error, "getMovements error");
  }
};

// @desc   Totals by reason over a period, e.g. how much was sold in the shop
//         vs online, received and written off this month
// @route  GET /api/admin/stock/summary?from=&to=
export const getStockSummary = async (req, res) => {
  try {
    const to = req.query.to && !Number.isNaN(Date.parse(req.query.to)) ? new Date(new Date(req.query.to).getTime() + 86400000 - 1) : new Date();
    const from = req.query.from && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86400000);
    const rows = await StockMovement.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, reason: { $nin: ["opening", "initial"] } } },
      { $group: { _id: "$reason", units: { $sum: "$change" }, movements: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      from, to,
      byReason: rows.map((r) => ({ reason: r._id, label: STOCK_REASONS[r._id] || r._id, units: r.units, movements: r.movements })),
    });
  } catch (error) {
    return sendServerError(res, error, "getStockSummary error");
  }
};
