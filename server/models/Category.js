import mongoose from "mongoose";

// Product categories, managed by the owner in the admin Categories screen.
// Two levels:
//   department: parent null (Skincare, Haircare, Body care, ...). Stored on
//               each product as `category`, which the shop, AI advisor and
//               My Vanity already group by.
//   category:   parent = a department's slug (Serums, Bar soaps, Perfumes,
//               ...). Stored on each product as `subcategory`.
// The slug never changes once made, so renaming never breaks a product.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, trim: true },
    parent: { type: String, default: null }, // department slug, or null for a department
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }, // hidden ones don't show in the shop
  },
  { timestamps: true },
);

categorySchema.index({ parent: 1, order: 1 });

export default mongoose.model("Category", categorySchema);
