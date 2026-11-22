// Customer list and detail for the admin (redesign stage 2). Customers are
// non-admin accounts. "Spent" counts paid orders that weren't cancelled
// (cancelled paid orders are refunded), the same rule as revenue.
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Booking from "../models/Booking.js";
import CustomerNote from "../models/CustomerNote.js";

const SAFE_USER_FIELDS = "name email createdAt loyaltyPoints loyaltyTier";
const SORTS = {
  newest: { createdAt: -1 },
  spent: { totalSpent: -1, createdAt: -1 },
  "last-order": { lastOrderAt: -1, createdAt: -1 },
  name: { name: 1 },
};
export const CUSTOMER_SORTS = Object.keys(SORTS);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listCustomers({ search = "", sort = "newest", page = 1, limit = 20 } = {}) {
  const match = { isAdmin: { $ne: true } };
  const q = search.trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    match.$or = [{ name: re }, { email: re }];
  }

  const [result] = await User.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Order.collection.name,
        let: { uid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user", "$$uid"] } } },
          { $sort: { createdAt: -1 } },
          { $project: { totalPrice: 1, isPaid: 1, status: 1, createdAt: 1, phone: "$deliveryAddress.phone" } },
        ],
        as: "orders",
      },
    },
    {
      $addFields: {
        ordersCount: { $size: "$orders" },
        paid: { $filter: { input: "$orders", cond: { $and: ["$$this.isPaid", { $ne: ["$$this.status", "cancelled"] }] } } },
        lastOrderAt: { $max: "$orders.createdAt" },
        phone: { $first: "$orders.phone" },
      },
    },
    { $addFields: { paidOrders: { $size: "$paid" }, totalSpent: { $sum: "$paid.totalPrice" } } },
    { $sort: SORTS[sort] || SORTS.newest },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { name: 1, email: 1, createdAt: 1, loyaltyPoints: 1, loyaltyTier: 1, ordersCount: 1, paidOrders: 1, totalSpent: 1, lastOrderAt: 1, phone: 1 } },
        ],
        count: [{ $count: "n" }],
      },
    },
  ]);

  const total = result.count[0]?.n || 0;
  return { customers: result.rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getCustomer(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await User.findOne({ _id: id, isAdmin: { $ne: true } }).select(`${SAFE_USER_FIELDS} pointsHistory`).lean();
  if (!user) return null;

  const [orders, notes, bookings] = await Promise.all([
    Order.find({ user: id })
      .select("totalPrice isPaid paidAt status createdAt orderItems.name orderItems.quantity deliveryAddress voucher refund.status")
      .sort({ createdAt: -1 })
      .lean(),
    CustomerNote.find({ customer: id }).populate("author", "name").sort({ createdAt: -1 }).lean(),
    Booking.find({ customer: id }).sort({ startsAt: -1 }).limit(20).lean(),
  ]);

  const paid = orders.filter((o) => o.isPaid && o.status !== "cancelled");
  const latestAddress = orders[0]?.deliveryAddress || null;
  return {
    customer: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      loyaltyPoints: user.loyaltyPoints || 0,
      loyaltyTier: user.loyaltyTier,
      phone: latestAddress?.phone || null,
      latestAddress,
    },
    stats: {
      ordersCount: orders.length,
      paidOrders: paid.length,
      totalSpent: paid.reduce((s, o) => s + (o.totalPrice || 0), 0),
      averageOrderValue: paid.length ? Math.round(paid.reduce((s, o) => s + (o.totalPrice || 0), 0) / paid.length) : 0,
      firstOrderAt: orders.at(-1)?.createdAt || null,
      lastOrderAt: orders[0]?.createdAt || null,
    },
    orders: orders.map(({ deliveryAddress: _a, ...o }) => ({
      ...o,
      itemsCount: (o.orderItems || []).reduce((s, i) => s + (i.quantity || 0), 0),
    })),
    pointsHistory: (user.pointsHistory || []).slice(-20).reverse(),
    notes: notes.map((n) => ({ _id: n._id, text: n.text, createdAt: n.createdAt, author: n.author?.name || "Admin" })),
    bookings,
  };
}

export async function addCustomerNote(customerId, authorId, text) {
  if (!mongoose.isValidObjectId(customerId)) return null;
  const exists = await User.exists({ _id: customerId, isAdmin: { $ne: true } });
  if (!exists) return null;
  const note = await CustomerNote.create({ customer: customerId, author: authorId, text });
  const author = await User.findById(authorId).select("name").lean();
  return { _id: note._id, text: note.text, createdAt: note.createdAt, author: author?.name || "Admin" };
}

export async function deleteCustomerNote(customerId, noteId) {
  if (!mongoose.isValidObjectId(noteId)) return false;
  const res = await CustomerNote.deleteOne({ _id: noteId, customer: customerId });
  return res.deletedCount === 1;
}
