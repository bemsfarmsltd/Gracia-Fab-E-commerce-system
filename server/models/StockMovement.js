import mongoose from "mongoose";

// One change to a product's stock count. The shop and the website sell from
// the same shelf, so every change is recorded here: online sales, in-store
// sales, deliveries, returns, write-offs and counts. A product's movements
// add up to its current stock (services/stock.js keeps them in step).
export const STOCK_REASONS = {
  opening: "Opening balance (stock before history began)",
  initial: "Stock when the product was added",
  online_sale: "Sold online (paid)",
  online_cancel: "Online order cancelled, back on the shelf",
  store_sale: "Sold in the shop",
  store_void: "In-store sale voided, back on the shelf",
  received: "Received (delivery from a supplier)",
  customer_return: "Returned by a customer",
  damaged: "Damaged",
  expired: "Expired",
  lost: "Lost or missing",
  count: "Stock count (set to what was counted)",
  correction: "Correction",
};

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Copied so history still reads right if the product is renamed or deleted.
    productName: String,
    change: { type: Number, required: true }, // + in, − out
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: Object.keys(STOCK_REASONS), required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    // In-store sale (till) this movement belongs to.
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "StoreSale" },
    note: { type: String, maxlength: 300 },
    // Who did it; empty for automatic changes (a customer's payment).
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ reason: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });

export default mongoose.model("StockMovement", stockMovementSchema);
