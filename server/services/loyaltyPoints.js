import User from "../models/User.js";

// Points for a purchase, online or in the shop: ₦1 = 0.01 points (₦1,000 =
// 10 points), at least 1 point for any paid purchase.
export const purchasePoints = (total) => {
  const amount = Number(total) || 0;
  return amount > 0 ? Math.max(1, Math.floor(amount * 0.01)) : 0;
};

// Takes back points a cancelled order or voided shop sale earned. The
// balance never goes below 0 (the customer may have spent them already).
export async function takeBackPoints(userId, points, reason) {
  if (!userId || !(points > 0)) return;
  await User.updateOne({ _id: userId }, [
    { $set: { loyaltyPoints: { $max: [0, { $subtract: [{ $ifNull: ["$loyaltyPoints", 0] }, points] }] } } },
  ]);
  await User.updateOne({ _id: userId }, { $push: { pointsHistory: { points: -points, reason, type: "reversal" } } });
}
