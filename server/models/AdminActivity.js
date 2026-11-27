import mongoose from "mongoose";

// Who changed what in the admin, and when. Written automatically for every
// successful admin change (middleware/activityLog.js); never edited or
// deleted through the API. Kept for 2 years.
const adminActivitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Copied so the log still reads right if the account is renamed or deleted.
    actorName: String,
    actorEmail: String,
    // e.g. "product.update", "stock.bulk_update", "order.status"
    action: { type: String, required: true },
    targetType: String, // "product", "order", "voucher", …
    targetId: String,
    // One readable line: 'Price ₦7,500 → ₦8,000 on "Shea Body Butter"'
    summary: String,
    // Field-level before/after where it matters: { price: { from, to } }
    changes: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ actor: 1, createdAt: -1 });
adminActivitySchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
adminActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export default mongoose.model("AdminActivity", adminActivitySchema);
