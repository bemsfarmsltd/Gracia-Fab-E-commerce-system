// Figures for the admin Overview: real numbers only, so the dashboard never
// shows a made-up trend. Days are counted in Nigerian time (Africa/Lagos,
// UTC+1 all year, no daylight saving).
//
// Shape of buildOverview():
// {
//   generatedAt, timezone: "Africa/Lagos",
//   totals: { revenue, onlineRevenue, shopRevenue, paidOrders, shopSales,
//             averageOrderValue, customers, products },
//   last7:  { revenue, onlineRevenue, shopRevenue, paidOrders, shopSales, newCustomers }, // last 7 days incl. today
//   prev7, last30, prev30: same shape (prev7 = the 7 days before last7),
//   daily: [{ date: "2026-11-22", ...same shape }], // 30 days, oldest first
//   statusCounts: { pending, paid, processing, shipped, delivered, cancelled },
//   recentOrders: [...5 newest, with user name/email],
//   lowStockThreshold, lowStock: [{ name, stock, category }], outOfStockCount,
// }
// Revenue = paid orders that weren't cancelled (cancelled paid orders are
// refunded), counted on the day they were paid, plus completed shop-till
// sales (voided ones are excluded), counted on the day they were rung up.
// revenue = onlineRevenue + shopRevenue. paidOrders and averageOrderValue are
// online orders only; shopSales counts till receipts. Comparisons are left to the
// client, which must not show a percentage when the earlier period is 0.
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import StoreSale from "../models/StoreSale.js";
import { LOW_STOCK_THRESHOLD } from "../config/inventory.js";

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];

// "YYYY-MM-DD" of the Lagos calendar day containing `date`.
export const lagosDay = (date) => new Date(new Date(date).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);

// UTC instant when the Lagos day `n` days before today's starts.
const startOfLagosDay = (now, daysAgo) => {
  const today = new Date(`${lagosDay(now)}T00:00:00.000Z`).getTime() - LAGOS_OFFSET_MS;
  return new Date(today - daysAgo * DAY_MS);
};

const FIELDS = ["revenue", "onlineRevenue", "shopRevenue", "paidOrders", "shopSales", "newCustomers"];
const empty = () => Object.fromEntries(FIELDS.map((k) => [k, 0]));

export async function buildOverview(now = new Date()) {
  const since = startOfLagosDay(now, 59); // 60 days: last30 + prev30

  const [paid, shopSales, shopTotalsAgg, newUsers, statusAgg, totalsAgg, customers, products, recentOrders, lowStock, outOfStockCount] = await Promise.all([
    Order.find({ isPaid: true, status: { $ne: "cancelled" }, paidAt: { $gte: since } }).select("totalPrice paidAt").lean(),
    StoreSale.find({ status: "completed", createdAt: { $gte: since } }).select("total createdAt").lean(),
    StoreSale.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, revenue: { $sum: "$total" }, n: { $sum: 1 } } },
    ]),
    User.find({ isAdmin: { $ne: true }, createdAt: { $gte: since } }).select("createdAt").lean(),
    Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { isPaid: true, status: { $ne: "cancelled" } } },
      { $group: { _id: null, revenue: { $sum: "$totalPrice" }, n: { $sum: 1 } } },
    ]),
    User.countDocuments({ isAdmin: { $ne: true } }),
    Product.countDocuments(),
    Order.find().populate("user", "name email").sort({ createdAt: -1 }).limit(5),
    Product.find({ stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } }).select("name stock category").sort({ stock: 1, name: 1 }).lean(),
    Product.countDocuments({ $or: [{ stock: { $lte: 0 } }, { stock: null }] }),
  ]);

  // One bucket per Lagos day for the last 60 days.
  const byDay = new Map();
  for (let i = 59; i >= 0; i--) byDay.set(lagosDay(startOfLagosDay(now, i)), empty());
  for (const o of paid) {
    const b = byDay.get(lagosDay(o.paidAt));
    if (b) { b.revenue += o.totalPrice || 0; b.onlineRevenue += o.totalPrice || 0; b.paidOrders += 1; }
  }
  for (const s of shopSales) {
    const b = byDay.get(lagosDay(s.createdAt));
    if (b) { b.revenue += s.total || 0; b.shopRevenue += s.total || 0; b.shopSales += 1; }
  }
  for (const u of newUsers) {
    const b = byDay.get(lagosDay(u.createdAt));
    if (b) b.newCustomers += 1;
  }
  const days = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));
  const sum = (list) => list.reduce((acc, d) => {
    for (const k of FIELDS) acc[k] += d[k];
    return acc;
  }, empty());

  const totals = totalsAgg[0] || { revenue: 0, n: 0 };
  const shopTotals = shopTotalsAgg[0] || { revenue: 0, n: 0 };
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const { _id, n } of statusAgg) if (_id in statusCounts) statusCounts[_id] = n;

  return {
    generatedAt: now.toISOString(),
    timezone: "Africa/Lagos",
    totals: {
      revenue: totals.revenue + shopTotals.revenue,
      onlineRevenue: totals.revenue,
      shopRevenue: shopTotals.revenue,
      paidOrders: totals.n,
      shopSales: shopTotals.n,
      averageOrderValue: totals.n ? Math.round(totals.revenue / totals.n) : 0,
      customers,
      products,
    },
    last7: sum(days.slice(-7)),
    prev7: sum(days.slice(-14, -7)),
    last30: sum(days.slice(-30)),
    prev30: sum(days.slice(0, 30)),
    daily: days.slice(-30),
    statusCounts,
    recentOrders,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    lowStock,
    outOfStockCount,
  };
}
