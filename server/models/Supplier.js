import mongoose from "mongoose";

// Who the shop buys stock from (owner only).
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 1 });

export default mongoose.model("Supplier", supplierSchema);
