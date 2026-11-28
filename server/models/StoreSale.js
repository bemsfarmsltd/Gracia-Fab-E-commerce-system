import mongoose from "mongoose";

// A sale made at the till in the Umuahia shop. Stock comes off the same
// count the website sells from, at the moment of sale (services/storeSales.js).
// Payment methods: config/storeSales.js.
const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 }, // whole naira, from the product at the time
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const storeSaleSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true }, // shown as S-000123
    items: { type: [lineSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountReason: String,
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, required: true },
    // Cash only: what the customer handed over, and the change given.
    amountTendered: Number,
    change: Number,
    paymentReference: String, // transfer / POS slip reference, optional
    customerName: String,
    customerPhone: String,
    // A registered customer picked at the till earns loyalty points, the
    // same as online (services/loyaltyPoints.js). Voiding takes them back.
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pointsAwarded: { type: Number, default: 0 },
    note: String,
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    soldByName: String,
    status: { type: String, enum: ["processing", "completed", "voided"], default: "processing" },
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidedByName: String,
    voidReason: String,
  },
  { timestamps: true },
);

storeSaleSchema.index({ createdAt: -1 });
storeSaleSchema.index({ soldBy: 1, createdAt: -1 });
storeSaleSchema.index({ customer: 1, createdAt: -1 });
storeSaleSchema.index({ status: 1, createdAt: -1 });

export const saleNumber = (n) => `S-${String(n).padStart(6, "0")}`;

export default mongoose.model("StoreSale", storeSaleSchema);
