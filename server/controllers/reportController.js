import Order from "../models/Order.js";
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

// @desc   Sales by month and best-selling products
// @route  GET /api/admin/reports/sales?months=6
export const getSalesReport = async (req, res) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
    const now = new Date();
    const start = watMonthStart(now, months - 1);
    // When the sale happened: paidAt, or createdAt for older orders without it.
    const soldAt = { $ifNull: ["$paidAt", "$createdAt"] };
    const inPeriod = { ...SOLD, $expr: { $gte: [soldAt, start] } };

    const [byMonth, topProducts] = await Promise.all([
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
        { $sort: { units: -1, sales: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Every month in the period, including ones with no sales, oldest first.
    const found = new Map(byMonth.map((m) => [m._id, m]));
    const monthRows = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const key = monthKey(watMonthStart(now, i));
      const m = found.get(key);
      monthRows.push({
        month: key,
        revenue: m?.revenue || 0,
        orders: m?.orders || 0,
        itemsSold: m?.itemsSold || 0,
        discounts: m?.discounts || 0,
        delivery: m?.delivery || 0,
        averageOrder: m?.orders ? Math.round(m.revenue / m.orders) : 0,
      });
    }

    const totals = monthRows.reduce(
      (t, m) => ({
        revenue: t.revenue + m.revenue,
        orders: t.orders + m.orders,
        itemsSold: t.itemsSold + m.itemsSold,
        discounts: t.discounts + m.discounts,
        delivery: t.delivery + m.delivery,
      }),
      { revenue: 0, orders: 0, itemsSold: 0, discounts: 0, delivery: 0 },
    );
    totals.averageOrder = totals.orders ? Math.round(totals.revenue / totals.orders) : 0;

    res.json({
      months: monthRows,
      totals,
      topProducts: topProducts.map((p) => ({
        productId: p._id,
        name: p.name,
        units: p.units,
        sales: p.sales,
        orders: p.orders,
      })),
    });
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
  const { from, to } = req.query;
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
    return res.status(400).json({ message: "Dates must look like 2026-11-30" });
  }
  const created = {};
  if (from) created.$gte = watDayStart(from);
  if (to) created.$lt = new Date(watDayStart(to).getTime() + 24 * 60 * 60 * 1000);
  // JavaScript rolls impossible dates over (31 Feb → 3 Mar), so check the
  // parsed date still reads back as the same day.
  const realDay = (day) => {
    if (!day) return true;
    const noon = new Date(`${day}T12:00:00Z`);
    return !Number.isNaN(noon.getTime()) && noon.toISOString().slice(0, 10) === day;
  };
  if (!realDay(from) || !realDay(to)) {
    return res.status(400).json({ message: "That date doesn't exist" });
  }
  if (created.$gte && created.$lt && created.$gte >= created.$lt) {
    return res.status(400).json({ message: "The start date must be on or before the end date" });
  }

  try {
    const orders = await Order.find(Object.keys(created).length ? { createdAt: created } : {})
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const lines = [
      COLUMNS.map(([h]) => csvCell(h)).join(","),
      ...orders.map((o) => COLUMNS.map(([, get]) => csvCell(get(o))).join(",")),
    ];
    const name = `gracia-fab-orders${from ? `-from-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Cache-Control", "no-store");
    // The BOM makes Excel read ₦ and other non-ASCII text correctly.
    res.send("﻿" + lines.join("\r\n") + "\r\n");
  } catch (error) {
    return sendServerError(res, error, "exportOrdersCsv error");
  }
};
