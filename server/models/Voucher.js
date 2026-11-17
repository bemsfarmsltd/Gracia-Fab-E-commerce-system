import mongoose from "mongoose";

// A discount code customers can enter at checkout. The discount always comes
// off the items subtotal (never delivery), and is calculated on the server —
// see services/vouchers.js.
const voucherSchema = new mongoose.Schema(
  {
    // Stored upper-case; customers can type it in any case.
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]{3,30}$/,
    },
    // "percent": value is a percentage (e.g. 20 = 20% off).
    // "fixed": value is an amount in NGN (e.g. 5000 = ₦5,000 off).
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 },
    // Optional cap on a percent discount, in NGN.
    maxDiscount: { type: Number, min: 0 },
    // Items subtotal needed before the code works, in NGN.
    minSubtotal: { type: Number, default: 0, min: 0 },
    // Only for customers with no previous paid order.
    firstOrderOnly: { type: Boolean, default: false },
    startsAt: Date,
    expiresAt: Date,
    // Total redemptions allowed (paid orders); empty = unlimited.
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    // Listed in the "Available vouchers" section on product pages.
    showOnProductPage: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Voucher", voucherSchema);
