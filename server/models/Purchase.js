import mongoose from "mongoose";

// A delivery received from a supplier, with what each unit cost. Recording
// one adds the stock ("received" movements) and updates the products' costs.
const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 }, // whole naira
    lineTotal: { type: Number, required: true, min: 0 },
    costBefore: Number, // average cost before this delivery
    costAfter: Number, // average cost after
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: String,
    items: { type: [lineSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 },
    invoiceRef: String,
    note: String,
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receivedByName: String,
  },
  { timestamps: true },
);

purchaseSchema.index({ receivedAt: -1 });
purchaseSchema.index({ supplier: 1, receivedAt: -1 });

export default mongoose.model("Purchase", purchaseSchema);
