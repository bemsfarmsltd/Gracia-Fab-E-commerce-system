import mongoose from "mongoose";
import AdminActivity from "../models/AdminActivity.js";
import { sendServerError } from "../utils/httpErrors.js";

const isId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);

// @desc   The admin activity log, newest first
// @route  GET /api/admin/activity?actor=&action=&targetType=&targetId=&from=&to=&page=&limit=
//   action: exact ("product.update") or a group ("product", "order", "stock")
//   from/to: dates (YYYY-MM-DD), inclusive
export const getActivity = async (req, res) => {
  try {
    const { actor, action, targetType, targetId, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const filter = {};
    if (actor) {
      if (!isId(actor)) return res.status(400).json({ message: "Invalid actor" });
      filter.actor = actor;
    }
    if (typeof action === "string" && /^[a-z_.]{2,40}$/.test(action)) {
      filter.action = action.includes(".") ? action : { $regex: `^${action}\\.` };
    }
    if (typeof targetType === "string" && /^[a-z]{2,20}$/.test(targetType)) filter.targetType = targetType;
    if (typeof targetId === "string" && /^[0-9a-f]{24}$/.test(targetId)) filter.targetId = targetId;
    const range = {};
    if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1);
    if (Object.keys(range).length) filter.createdAt = range;

    const [items, total] = await Promise.all([
      AdminActivity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-ip -__v").lean(),
      AdminActivity.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    return sendServerError(res, error, "getActivity error");
  }
};
