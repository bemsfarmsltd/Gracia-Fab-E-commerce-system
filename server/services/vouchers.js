import Voucher from "../models/Voucher.js";
import Order from "../models/Order.js";

export class VoucherError extends Error {}

const naira = (n) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export const normalizeCode = (code) => String(code || "").trim().toUpperCase();

// Customer-facing summary, built from the voucher's real rules so what the
// site advertises can never drift from what checkout accepts.
export function describeVoucher(v) {
  const discountLabel =
    v.type === "percent" ? `${v.value}% OFF` : `${naira(v.value)} OFF`;
  const conditions = [];
  if (v.firstOrderOnly) conditions.push("First order only");
  if (v.minSubtotal > 0) conditions.push(`Min spend ${naira(v.minSubtotal)}`);
  if (v.type === "percent" && v.maxDiscount) conditions.push(`Up to ${naira(v.maxDiscount)} off`);
  if (v.expiresAt) {
    conditions.push(
      `Ends ${new Date(v.expiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`,
    );
  }
  return {
    code: v.code,
    discountLabel,
    conditionLabel: conditions.join(" · ") || "No minimum spend",
  };
}

// Discount on an items subtotal, in whole naira, never more than the subtotal.
export function computeDiscount(v, itemsPrice) {
  let discount =
    v.type === "percent" ? Math.round((itemsPrice * v.value) / 100) : v.value;
  if (v.type === "percent" && v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
  return Math.max(0, Math.min(discount, itemsPrice));
}

// Checks a code against every rule for this customer and subtotal.
// Returns { voucher, discount } or throws VoucherError with a message that's
// safe to show the customer.
export async function checkVoucher({ code, userId, itemsPrice }) {
  const normalized = normalizeCode(code);
  const voucher = normalized ? await Voucher.findOne({ code: normalized }) : null;
  const now = new Date();

  if (!voucher || !voucher.active) {
    throw new VoucherError("That voucher code isn't valid.");
  }
  if (voucher.startsAt && voucher.startsAt > now) {
    throw new VoucherError("That voucher isn't active yet.");
  }
  if (voucher.expiresAt && voucher.expiresAt < now) {
    throw new VoucherError("That voucher has expired.");
  }
  if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
    throw new VoucherError("That voucher has been fully redeemed.");
  }
  if (itemsPrice < (voucher.minSubtotal || 0)) {
    throw new VoucherError(
      `${voucher.code} needs a minimum spend of ${naira(voucher.minSubtotal)} (your items come to ${naira(itemsPrice)}).`,
    );
  }
  if (voucher.firstOrderOnly && userId) {
    const hasPaidOrder = await Order.exists({ user: userId, isPaid: true });
    if (hasPaidOrder) {
      throw new VoucherError(`${voucher.code} is for your first order only.`);
    }
  }

  return { voucher, discount: computeDiscount(voucher, itemsPrice) };
}

// The three codes the product page has always advertised, with the terms it
// showed. Used by data/seedVouchers.js to create them in a live database.
export const ADVERTISED_VOUCHERS = [
  { code: "GLOW05", type: "percent", value: 5, firstOrderOnly: true, showOnProductPage: true },
  { code: "BEAUTY20", type: "percent", value: 20, minSubtotal: 25000, showOnProductPage: true },
  { code: "LUXE5K", type: "fixed", value: 5000, minSubtotal: 50000, showOnProductPage: true },
];
