import mongoose from "mongoose";

// A stock count. Staff count (scan or type); the owner reviews the
// differences and approves them. The shop can stay open: each line keeps
// the system's count at the moment that product was first counted
// (systemAtCount), and only the difference counted − systemAtCount is
// applied, so sales made during the count aren't lost.
const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    counted: { type: Number, required: true, min: 0 },
    systemAtCount: { type: Number, required: true, min: 0 },
    firstCountedAt: { type: Date, default: Date.now },
    lastCountedBy: String,
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    counted: Number, // null for an uncounted product set to 0
    systemAtCount: Number,
    difference: Number, // what was applied (+ found, − missing)
    stockAfter: Number,
    note: String,
  },
  { _id: false },
);

const stockTakeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: String, // only this category, or everything when empty
    status: { type: String, enum: ["open", "completed", "cancelled"], default: "open" },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startedByName: String,
    lines: [lineSchema],
    completedAt: Date,
    completedByName: String,
    zeroedUncounted: Boolean,
    results: [resultSchema],
    totals: { products: Number, missingUnits: Number, extraUnits: Number, unchanged: Number },
  },
  { timestamps: true },
);

// At most one open count at a time.
stockTakeSchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: "open" } });
stockTakeSchema.index({ createdAt: -1 });

export default mongoose.model("StockTake", stockTakeSchema);
