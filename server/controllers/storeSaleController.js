import StoreSale, { saleNumber } from "../models/StoreSale.js";
import { createSale, voidSale, salesSummary, findTillCustomers, SaleError } from "../services/storeSales.js";
import { STORE_PAYMENT_METHODS } from "../config/storeSales.js";
import { hasPermission } from "../utils/roles.js";
import { sendServerError } from "../utils/httpErrors.js";

const isId = (v) => typeof v === "string" && /^[0-9a-f]{24}$/.test(v);
const naira = (n) => `₦${Math.round(n).toLocaleString("en-NG")}`;

// Start of today in Lagos (UTC+1, no daylight saving).
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
export function startOfLagosDay(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET_MS);
}

const view = (s) => ({ ...s, numberLabel: saleNumber(s.number) });

// Staff (no "reports" permission) only ever see their own sales from today,
// enough to cash up; the owner sees everything.
function scope(req) {
  const filter = {};
  const seeAll = hasPermission(req.user, "reports");
  if (!seeAll) {
    filter.soldBy = req.user._id;
    filter.createdAt = { $gte: startOfLagosDay() };
    return { filter, seeAll };
  }
  const { from, to, method, soldBy } = req.query;
  const range = {};
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(new Date(from).getTime() - LAGOS_OFFSET_MS);
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(new Date(to).getTime() + 86400000 - 1 - LAGOS_OFFSET_MS);
  if (Object.keys(range).length) filter.createdAt = range;
  if (method && STORE_PAYMENT_METHODS.some((m) => m.id === method)) filter.paymentMethod = method;
  if (isId(soldBy)) filter.soldBy = soldBy;
  return { filter, seeAll };
}

const fail = (res, error, context) => {
  if (error instanceof SaleError) return res.status(error.status).json({ message: error.message, ...(error.details || {}) });
  return sendServerError(res, error, context);
};

// @route  GET /api/admin/sales/options
export const getSaleOptions = (req, res) => {
  res.json({ paymentMethods: STORE_PAYMENT_METHODS, canDiscount: Boolean(req.user.isAdmin), canVoid: hasPermission(req.user, "store.void") });
};

// @route  POST /api/admin/sales
export const postSale = async (req, res) => {
  try {
    const sale = await createSale(req.body, req.user);
    res.locals.activity = {
      targetType: "sale",
      targetId: String(sale._id),
      summary: `Shop sale ${saleNumber(sale.number)}: ${sale.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}, ${naira(sale.total)} by ${sale.paymentMethod}`,
      changes: { total: sale.total, paymentMethod: sale.paymentMethod, items: sale.items.length, ...(sale.pointsAwarded ? { pointsAwarded: sale.pointsAwarded } : {}) },
    };
    // customerPoints: the customer's new balance, for the receipt.
    res.status(201).json({ ...view(sale.toObject()), ...(sale.customerPoints !== undefined ? { customerPoints: sale.customerPoints } : {}) });
  } catch (error) {
    return fail(res, error, "postSale error");
  }
};

// @route  GET /api/admin/sales/customers?q=  (loyalty: find the customer at the till)
export const getTillCustomers = async (req, res) => {
  try {
    res.json(await findTillCustomers(req.query.q));
  } catch (error) {
    return fail(res, error, "getTillCustomers error");
  }
};

// @route  GET /api/admin/sales?from=&to=&method=&soldBy=&page=&limit=
export const getSales = async (req, res) => {
  try {
    const { filter, seeAll } = scope(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    filter.status = { $in: ["completed", "voided"] };
    const [items, total] = await Promise.all([
      StoreSale.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StoreSale.countDocuments(filter),
    ]);
    res.json({ items: items.map(view), total, page, pages: Math.max(1, Math.ceil(total / limit)), scope: seeAll ? "all" : "mine-today" });
  } catch (error) {
    return fail(res, error, "getSales error");
  }
};

// @route  GET /api/admin/sales/summary?from=&to=   (cash-up)
export const getSalesSummary = async (req, res) => {
  try {
    const { filter, seeAll } = scope(req);
    res.json({ ...(await salesSummary(filter)), scope: seeAll ? "all" : "mine-today" });
  } catch (error) {
    return fail(res, error, "getSalesSummary error");
  }
};

// @route  GET /api/admin/sales/:id   (receipt)
export const getSale = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Sale not found" });
    const sale = await StoreSale.findById(req.params.id).lean();
    const mine = sale && String(sale.soldBy) === String(req.user._id);
    if (!sale || (!mine && !hasPermission(req.user, "reports"))) return res.status(404).json({ message: "Sale not found" });
    res.json(view(sale));
  } catch (error) {
    return fail(res, error, "getSale error");
  }
};

// @route  POST /api/admin/sales/:id/void   { reason }   (owner)
export const postVoidSale = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Sale not found" });
    const sale = await voidSale(req.params.id, req.body, req.user);
    res.locals.activity = {
      targetType: "sale",
      summary: `Voided shop sale ${saleNumber(sale.number)} (${naira(sale.total)}): ${req.body.reason}; stock put back`,
      changes: { status: { from: "completed", to: "voided" }, total: sale.total },
    };
    res.json(view(sale.toObject()));
  } catch (error) {
    return fail(res, error, "postVoidSale error");
  }
};
