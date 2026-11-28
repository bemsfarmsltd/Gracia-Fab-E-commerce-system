import Order from "../models/Order.js";
import StoreSale, { saleNumber } from "../models/StoreSale.js";
import { STORE_PAYMENT_METHODS, STORE_PAYMENT_METHOD_IDS } from "../config/storeSales.js";
import { sendServerError } from "../utils/httpErrors.js";

// Nigeria is on WAT (UTC+1) all year, with no daylight saving, so months and
// days are counted in WAT rather than UTC: an order paid at 00:30 on 1 Dec WAT
// belongs to December.
const WAT = "+01:00";
const WAT_OFFSET_MS = 60 * 60 * 1000;

// Paid orders that count as sales: paid and not cancelled (a cancelled paid
// order is refunded, so it isn't revenue).
const SOLD = { isPaid: true, status: { $ne: "cancelled" } };

// First instant of the WAT month `monthsBack` months before the current one.
function watMonthStart(now, monthsBack) {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth() - monthsBack, 1) - WAT_OFFSET_MS);
}

const monthKey = (date) => new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 7);

// @desc   Sales by month and best-selling products: online orders plus
//         completed shop-till sales (voided ones are left out).
// @route  GET /api/admin/reports/sales?months=6
//
// Each month: revenue (online + shop), onlineRevenue, shopRevenue, orders
// (paid online orders), shopSales (till receipts), itemsSold (both),
// discounts (vouchers + till discounts), delivery (online only) and
// averageOrder (online only). totals has the same fields plus shopByMethod.
export const getSalesReport = async (req, res) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
    const now = new Date();
    const start = watMonthStart(now, months - 1);
    // When the sale happened: paidAt, or createdAt for older orders without it.
    const soldAt = { $ifNull: ["$paidAt", "$createdAt"] };
    const inPeriod = { ...SOLD, $expr: { $gte: [soldAt, start] } };
    const shopInPeriod = { status: "completed", createdAt: { $gte: start } };

    const [byMonth, onlineProducts, shopByMonth, shopProducts, shopMethods] = await Promise.all([
      Order.aggregate([
        { $match: inPeriod },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: soldAt, timezone: WAT } },
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
            discounts: { $sum: { $ifNull: ["$discount", 0] } },
            delivery: { $sum: { $ifNull: ["$deliveryPrice", 0] } },
            itemsSold: { $sum: { $sum: "$orderItems.quantity" } },
          },
        },
      ]),
      Order.aggregate([
        { $match: inPeriod },
        { $unwind: "$orderItems" },
        {
          $group: {
            _id: "$orderItems.product",
            name: { $last: "$orderItems.name" },
            units: { $sum: "$orderItems.quantity" },
            // Item price × quantity, before any voucher discount.
            sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
            orders: { $sum: 1 },
          },
        },
      ]),
      StoreSale.aggregate([
        { $match: shopInPeriod },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: WAT } },
            revenue: { $sum: "$total" },
            sales: { $sum: 1 },
            discounts: { $sum: { $ifNull: ["$discount", 0] } },
            itemsSold: { $sum: { $sum: "$items.quantity" } },
          },
        },
      ]),
      StoreSale.aggregate([
        { $match: shopInPeriod },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $last: "$items.name" },
            units: { $sum: "$items.quantity" },
            // Line totals, before any till discount on the whole sale.
            sales: { $sum: "$items.lineTotal" },
            receipts: { $sum: 1 },
          },
        },
      ]),
      StoreSale.aggregate([
        { $match: shopInPeriod },
        { $group: { _id: "$paymentMethod", sales: { $sum: 1 }, total: { $sum: "$total" } } },
      ]),
    ]);

    // Every month in the period, including ones with no sales, oldest first.
    const found = new Map(byMonth.map((m) => [m._id, m]));
    const shopFound = new Map(shopByMonth.map((m) => [m._id, m]));
    const monthRows = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const key = monthKey(watMonthStart(now, i));
      const m = found.get(key) || {};
      const s = shopFound.get(key) || {};
      const onlineRevenue = m.revenue || 0;
      const shopRevenue = s.revenue || 0;
      monthRows.push({
        month: key,
        revenue: onlineRevenue + shopRevenue,
        onlineRevenue,
        shopRevenue,
        orders: m.orders || 0,
        shopSales: s.sales || 0,
        itemsSold: (m.itemsSold || 0) + (s.itemsSold || 0),
        discounts: (m.discounts || 0) + (s.discounts || 0),
        delivery: m.delivery || 0,
        averageOrder: m.orders ? Math.round(onlineRevenue / m.orders) : 0,
      });
    }

    const SUMMED = ["revenue", "onlineRevenue", "shopRevenue", "orders", "shopSales", "itemsSold", "discounts", "delivery"];
    const totals = Object.fromEntries(SUMMED.map((k) => [k, monthRows.reduce((t, m) => t + m[k], 0)]));
    totals.averageOrder = totals.orders ? Math.round(totals.onlineRevenue / totals.orders) : 0;
    // Every till payment method in the till's order, plus any retired ones.
    const byMethod = new Map(shopMethods.map((r) => [r._id, r]));
    totals.shopByMethod = [
      ...STORE_PAYMENT_METHODS.map(({ id, label }) => ({ method: id, label, sales: byMethod.get(id)?.sales || 0, total: byMethod.get(id)?.total || 0 })),
      ...shopMethods
        .filter((r) => !STORE_PAYMENT_METHOD_IDS.includes(r._id))
        .map((r) => ({ method: r._id, label: r._id, sales: r.sales, total: r.total })),
    ];

    // Best sellers across both channels.
    const products = new Map();
    const entry = (p) => {
      const id = String(p._id);
      if (!products.has(id)) {
        products.set(id, { productId: p._id, name: p.name, units: 0, onlineUnits: 0, shopUnits: 0, sales: 0, orders: 0, shopSales: 0 });
      }
      return products.get(id);
    };
    for (const p of onlineProducts) {
      const e = entry(p);
      e.name = p.name;
      e.units += p.units;
      e.onlineUnits += p.units;
      e.sales += p.sales;
      e.orders += p.orders;
    }
    for (const p of shopProducts) {
      const e = entry(p);
      e.units += p.units;
      e.shopUnits += p.units;
      e.sales += p.sales;
      e.shopSales += p.receipts;
    }
    const topProducts = [...products.values()]
      .sort((a, b) => b.units - a.units || b.sales - a.sales)
      .slice(0, 10);

    res.json({ months: monthRows, totals, topProducts });
  } catch (error) {
    return sendServerError(res, error, "getSalesReport error");
  }
};

// ── CSV export ────────────────────────────

// Quotes a cell when needed, and defuses spreadsheet formulas: a customer
// could type "=HYPERLINK(...)" as their name, which Excel would run.
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const watDate = (d) => (d ? new Date(new Date(d).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ") : "");

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// "2026-11-01" as the start of that day in WAT.
const watDayStart = (day) => new Date(`${day}T00:00:00${WAT}`);

// Reads optional ?from=&to= ("YYYY-MM-DD", inclusive, WAT days) into a
// createdAt filter, or { error } when the dates are no good.
function createdRange({ from, to }) {
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
    return { error: "Dates must look like 2026-11-30" };
  }
  // JavaScript rolls impossible dates over (31 Feb → 3 Mar), so check the
  // parsed date still reads back as the same day.
  const realDay = (day) => {
    if (!day) return true;
    const noon = new Date(`${day}T12:00:00Z`);
    return !Number.isNaN(noon.getTime()) && noon.toISOString().slice(0, 10) === day;
  };
  if (!realDay(from) || !realDay(to)) return { error: "That date doesn't exist" };
  const created = {};
  if (from) created.$gte = watDayStart(from);
  if (to) created.$lt = new Date(watDayStart(to).getTime() + 24 * 60 * 60 * 1000);
  if (created.$gte && created.$lt && created.$gte >= created.$lt) {
    return { error: "The start date must be on or before the end date" };
  }
  return { filter: Object.keys(created).length ? { createdAt: created } : {} };
}

const rangeName = (base, { from, to }) => `${base}${from ? `-from-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;

function sendCsv(res, name, columns, rows) {
  const lines = [
    columns.map(([h]) => csvCell(h)).join(","),
    ...rows.map((row) => columns.map(([, get]) => csvCell(get(row))).join(",")),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");
  // The BOM makes Excel read ₦ and other non-ASCII text correctly.
  res.send("﻿" + lines.join("\r\n") + "\r\n");
}

const COLUMNS = [
  ["Order ID", (o) => o._id.toString().slice(-8).toUpperCase()],
  ["Placed (WAT)", (o) => watDate(o.createdAt)],
  ["Customer", (o) => o.deliveryAddress?.fullName || o.user?.name || ""],
  ["Email", (o) => o.user?.email || ""],
  ["Phone", (o) => o.deliveryAddress?.phone || ""],
  ["Address", (o) => o.deliveryAddress?.address || ""],
  ["City", (o) => o.deliveryAddress?.city || ""],
  ["State", (o) => o.deliveryAddress?.state || ""],
  ["Items", (o) => o.orderItems.map((i) => `${i.name} x${i.quantity}`).join("; ")],
  ["Units", (o) => o.orderItems.reduce((n, i) => n + i.quantity, 0)],
  ["Items total (NGN)", (o) => o.itemsPrice],
  ["Voucher", (o) => o.voucher?.code || ""],
  ["Discount (NGN)", (o) => o.discount || 0],
  ["Delivery (NGN)", (o) => o.deliveryPrice],
  ["Total (NGN)", (o) => o.totalPrice],
  ["Paid", (o) => (o.isPaid ? "Yes" : "No")],
  ["Paid at (WAT)", (o) => watDate(o.paidAt)],
  ["Payment method", (o) => o.paymentResult?.channel || ""],
  ["Payment reference", (o) => o.paymentResult?.transactionReference || o.paymentReference || ""],
  ["Status", (o) => o.status],
  ["Refund", (o) => (o.refund?.status && o.refund.status !== "none" ? o.refund.status : "")],
  ["Cancel reason", (o) => o.cancelReason || ""],
];

// @desc   Download orders as a CSV spreadsheet
// @route  GET /api/admin/orders/export?from=YYYY-MM-DD&to=YYYY-MM-DD
//         Both dates optional and inclusive, in WAT.
export const exportOrdersCsv = async (req, res) => {
  const { filter, error } = createdRange(req.query);
  if (error) return res.status(400).json({ message: error });
  try {
    const orders = await Order.find(filter).populate("user", "name email").sort({ createdAt: -1 }).lean();
    sendCsv(res, rangeName("gracia-fab-orders", req.query), COLUMNS, orders);
  } catch (err) {
    return sendServerError(res, err, "exportOrdersCsv error");
  }
};

const METHOD_LABELS = Object.fromEntries(STORE_PAYMENT_METHODS.map((m) => [m.id, m.label]));

const SHOP_COLUMNS = [
  ["Receipt", (s) => saleNumber(s.number)],
  ["Sold (WAT)", (s) => watDate(s.createdAt)],
  ["Sold by", (s) => s.soldByName || ""],
  ["Items", (s) => s.items.map((i) => `${i.name} x${i.quantity}`).join("; ")],
  ["Units", (s) => s.items.reduce((n, i) => n + i.quantity, 0)],
  ["Subtotal (NGN)", (s) => s.subtotal],
  ["Discount (NGN)", (s) => s.discount || 0],
  ["Discount reason", (s) => s.discountReason || ""],
  ["Total (NGN)", (s) => s.total],
  ["Payment method", (s) => METHOD_LABELS[s.paymentMethod] || s.paymentMethod],
  ["Payment reference", (s) => s.paymentReference || ""],
  ["Customer", (s) => s.customerName || ""],
  ["Customer phone", (s) => s.customerPhone || ""],
  ["Status", (s) => s.status],
  ["Voided (WAT)", (s) => watDate(s.voidedAt)],
  ["Voided by", (s) => s.voidedByName || ""],
  ["Void reason", (s) => s.voidReason || ""],
];

// @desc   Download shop-till sales as a CSV spreadsheet. Voided sales are
//         included (see the Status column) so receipt numbers have no gaps.
// @route  GET /api/admin/reports/shop-sales/export?from=YYYY-MM-DD&to=YYYY-MM-DD
export const exportShopSalesCsv = async (req, res) => {
  const { filter, error } = createdRange(req.query);
  if (error) return res.status(400).json({ message: error });
  try {
    const sales = await StoreSale.find(filter).sort({ createdAt: -1 }).lean();
    sendCsv(res, rangeName("gracia-fab-shop-sales", req.query), SHOP_COLUMNS, sales);
  } catch (err) {
    return sendServerError(res, err, "exportShopSalesCsv error");
  }
};
