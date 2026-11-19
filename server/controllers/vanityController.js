import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { sendServerError } from "../utils/httpErrors.js";
import { loyaltySummary } from "./loyaltyController.js";
import { LOW_STOCK_THRESHOLD } from "../config/inventory.js";
import {
  SKIN_CONCERNS,
  HAIR_CONCERNS,
  BUDGET_RANGES,
  PROFILE_STEPS,
  profileOptions,
} from "../config/beautyProfile.js";

// My Vanity: one private page per customer, built only from their own data
// and real, in-stock products. Nothing here is invented: picks come with the
// actual reason they were chosen.

const DAY = 24 * 60 * 60 * 1000;
const PRODUCT_FIELDS = "name brand price image category stock isInStock rating numReviews suitableFor";
const CATEGORY_LABEL = { skincare: "skincare", haircare: "haircare", wig: "wigs", bridal: "bridal beauty" };
// Products people use up and buy again.
const REPEAT_CATEGORIES = ["skincare", "haircare"];

const inStock = (p) => Number(p?.stock) > 0 && p?.isInStock !== false;

// Shape every product the same way for the page.
export const card = (p) => ({
  _id: p._id,
  name: p.name,
  brand: p.brand,
  price: p.price,
  image: p.image,
  category: p.category,
  inStock: inStock(p),
  lowStock: inStock(p) && Number(p.stock) <= LOW_STOCK_THRESHOLD,
  rating: p.numReviews > 0 ? p.rating : null,
  numReviews: p.numReviews || 0,
});

const cleanProfile = (bp = {}) => ({
  skinType: bp.skinType || null,
  hairType: bp.hairType || null,
  skinConcerns: bp.skinConcerns || [],
  hairConcerns: bp.hairConcerns || [],
  shoppingFor: bp.shoppingFor || [],
  budget: bp.budget || null,
  undertone: bp.undertone || null,
  updatedAt: bp.updatedAt || null,
});

const completeness = (profile) => {
  const filled = PROFILE_STEPS.filter((k) => {
    const v = profile[k];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  });
  return {
    done: filled.length,
    total: PROFILE_STEPS.length,
    missing: PROFILE_STEPS.filter((k) => !filled.includes(k)),
  };
};

// Score one product against the profile; returns { score, reasons }.
export const scoreProduct = (p, profile, viewedCategories = new Set()) => {
  const s = p.suitableFor || {};
  const skin = (s.skinType || []).map((v) => v.toLowerCase());
  const hair = (s.hairType || []).map((v) => v.toLowerCase());
  const concerns = (s.concern || []).map((v) => v.toLowerCase());
  let score = 0;
  const reasons = [];

  if (profile.skinType && p.category !== "wig") {
    if (skin.includes(profile.skinType)) {
      score += 3;
      reasons.push(`Suits ${profile.skinType} skin`);
    } else if (skin.includes("all")) score += 1;
  }
  if (profile.hairType && (p.category === "haircare" || p.category === "wig")) {
    if (hair.includes(profile.hairType)) {
      score += 3;
      reasons.push(`For ${profile.hairType} hair`);
    } else if (hair.includes("all")) score += 1;
  }
  for (const [ids, groups] of [[profile.skinConcerns, SKIN_CONCERNS], [profile.hairConcerns, HAIR_CONCERNS]]) {
    for (const id of ids) {
      const g = groups[id];
      if (g && g.terms.some((t) => concerns.includes(t))) {
        score += 2;
        reasons.push(`Targets ${g.label.toLowerCase()}`);
      }
    }
  }
  if (profile.shoppingFor.includes(p.category)) score += 2;
  if (viewedCategories.has(p.category)) {
    score += 1;
    if (!reasons.length) reasons.push(`Because you've been browsing ${CATEGORY_LABEL[p.category] || p.category}`);
  }
  if (profile.budget && BUDGET_RANGES[profile.budget]) {
    const [lo, hi] = BUDGET_RANGES[profile.budget];
    if (p.price >= lo && p.price <= hi) score += 1;
  }
  return { score, reasons: reasons.slice(0, 2) };
};

const pickProducts = async (profile, { exclude, viewedCategories }) => {
  const candidates = await Product.find({ stock: { $gt: 0 }, isInStock: { $ne: false } })
    .select(PRODUCT_FIELDS)
    .lean();
  const pool = candidates.filter((p) => !exclude.has(String(p._id)));

  const scored = pool
    .map((p) => ({ p, ...scoreProduct(p, profile, viewedCategories) }))
    .filter((x) => x.score > 0 && x.reasons.length)
    .sort((a, b) => b.score - a.score || (b.p.numReviews || 0) - (a.p.numReviews || 0) || String(b.p._id).localeCompare(String(a.p._id)));

  if (scored.length) {
    return { basis: "profile", items: scored.slice(0, 8).map((x) => ({ ...card(x.p), reasons: x.reasons })) };
  }
  // No profile answers or browsing yet: say honestly that these are just new.
  const newest = pool.sort((a, b) => String(b._id).localeCompare(String(a._id))).slice(0, 8);
  return { basis: "new", items: newest.map((p) => ({ ...card(p), reasons: ["New in store"] })) };
};

const ACTIVE_STATUSES = ["paid", "processing", "shipped"];

// @desc   Everything for the customer's My Vanity page
// @route  GET /api/vanity
export const getVanity = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("name beautyProfile wishlist interests savedRecommendations loyaltyPoints loyaltyTier pointsHistory createdAt")
      .populate({ path: "wishlist", select: PRODUCT_FIELDS })
      .populate({ path: "interests.productId", select: PRODUCT_FIELDS })
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const profile = cleanProfile(user.beautyProfile);
    const now = Date.now();

    const orders = await Order.find({ user: user._id, status: { $ne: "cancelled" } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Orders still on their way, plus unpaid ones that haven't expired (48h).
    const activeOrders = orders
      .filter((o) => ACTIVE_STATUSES.includes(o.status) || (o.status === "pending" && !o.isPaid && now - new Date(o.createdAt) < 2 * DAY))
      .slice(0, 3)
      .map((o) => ({
        _id: o._id,
        status: o.status,
        isPaid: o.isPaid,
        createdAt: o.createdAt,
        totalPrice: o.totalPrice,
        itemCount: (o.orderItems || []).reduce((n, i) => n + (i.quantity || 1), 0),
        image: o.orderItems?.[0]?.image || null,
        statusHistory: (o.statusHistory || []).map((h) => ({ status: h.status, date: h.changedAt || null })),
      }));

    // Bought 5 to 13 weeks ago, used up by now, and not bought again since.
    const paid = orders.filter((o) => o.isPaid);
    const lastBought = new Map();
    for (const o of paid) {
      const when = new Date(o.paidAt || o.createdAt).getTime();
      for (const i of o.orderItems || []) {
        const id = String(i.product);
        if (!lastBought.has(id) || lastBought.get(id) < when) lastBought.set(id, when);
      }
    }
    const dueIds = [...lastBought].filter(([, t]) => now - t >= 35 * DAY && now - t <= 90 * DAY).map(([id]) => id);
    const dueProducts = dueIds.length
      ? await Product.find({ _id: { $in: dueIds }, category: { $in: REPEAT_CATEGORIES } }).select(PRODUCT_FIELDS).lean()
      : [];
    const restock = dueProducts
      .filter(inStock)
      .slice(0, 4)
      .map((p) => ({ ...card(p), lastBought: new Date(lastBought.get(String(p._id))) }));

    const recentlyBought = new Set([...lastBought].filter(([, t]) => now - t < 35 * DAY).map(([id]) => id));

    const wishlist = (user.wishlist || []).filter(Boolean);
    const recentlyViewed = (user.interests || [])
      .filter((i) => i.productId)
      .sort((a, b) => new Date(b.lastViewed) - new Date(a.lastViewed))
      .slice(0, 6)
      .map((i) => card(i.productId));
    const viewedCategories = new Set((user.interests || []).map((i) => i.productId?.category || i.category).filter(Boolean));

    const picks = await pickProducts(profile, {
      exclude: new Set([...wishlist.map((p) => String(p._id)), ...recentlyBought]),
      viewedCategories,
    });

    const latestRec = (user.savedRecommendations || []).slice(-1)[0];
    let savedRoutine = null;
    if (latestRec?.products?.length) {
      const recProducts = await Product.find({ _id: { $in: latestRec.products } }).select(PRODUCT_FIELDS).lean();
      savedRoutine = { date: latestRec.date, products: recProducts.map(card) };
    }

    res.set("Cache-Control", "private, no-store");
    res.json({
      firstName: String(user.name || "").trim().split(/\s+/)[0] || null,
      memberSince: user.createdAt,
      profile,
      completeness: completeness(profile),
      options: profileOptions(),
      picks,
      activeOrders,
      restock,
      wishlist: { count: wishlist.length, items: wishlist.slice(0, 6).map(card) },
      recentlyViewed,
      savedRoutine,
      loyalty: loyaltySummary(user),
    });
  } catch (error) {
    return sendServerError(res, error, "getVanity error");
  }
};

// @desc   Update (part of) the beauty profile. null or [] clears a field.
// @route  PUT /api/vanity/profile
export const updateBeautyProfile = async (req, res) => {
  try {
    const set = {};
    const unset = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (v === null || (Array.isArray(v) && v.length === 0) || v === "") unset[`beautyProfile.${k}`] = "";
      else set[`beautyProfile.${k}`] = v;
    }
    set["beautyProfile.updatedAt"] = new Date();
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    ).select("beautyProfile");
    if (!user) return res.status(404).json({ message: "User not found" });
    const profile = cleanProfile(user.beautyProfile);
    res.json({ profile, completeness: completeness(profile) });
  } catch (error) {
    return sendServerError(res, error, "updateBeautyProfile error");
  }
};

// @desc   Delete every beauty profile answer
// @route  DELETE /api/vanity/profile
export const clearBeautyProfile = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $unset: { beautyProfile: "" } });
    const profile = cleanProfile();
    res.json({ profile, completeness: completeness(profile) });
  } catch (error) {
    return sendServerError(res, error, "clearBeautyProfile error");
  }
};
