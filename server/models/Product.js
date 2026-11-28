import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    rating: {
      type: Number,
      required: true,
    },

    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    image: {
      type: String,
      required: true,
    },

    // Optional second photo (e.g. a different angle) shown when a shopper
    // hovers the product card — falls back to `image` when not set.
    secondaryImage: {
      type: String,
    },

    // Department slug (skincare, haircare, ...) and, inside it, the
    // category slug (serums, bar-soaps, ...). Both are managed in the admin
    // Categories screen; see models/Category.js.
    category: {
      type: String,
      required: true,
    },
    subcategory: { type: String, default: null },

    tags: [String],

    suitableFor: {
      skinType: [String],
      hairType: [String],
      concern: [String],
    },

    brand: {
      type: String,
    },

    // The shop's own code (GF-000123), given to every product, printed on
    // labels as a Code 128 barcode.
    sku: { type: String, trim: true },
    // What a scanner reads: the manufacturer's barcode (EAN-13, UPC…) when
    // the product has one, otherwise the SKU. See services/barcodes.js.
    barcode: { type: String, trim: true },

    // ── Costs (owner only). select: false keeps them out of every query
    // unless asked for with .select("+costPrice"), so the shop and staff never
    // receive them. costPrice is the average cost of what's on the shelf
    // (updated by deliveries, services/costing.js); lastCost the latest price.
    costPrice: { type: Number, min: 0, select: false },
    lastCost: { type: Number, min: 0, select: false },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", select: false },
    // Reorder when stock falls to this (empty = no reminder).
    reorderLevel: { type: Number, min: 0 },

    // Stock management. Defaults to 0: a product nobody has counted is
    // treated as out of stock rather than given an invented quantity.
    // Counts are entered from the admin dashboard's Inventory tab.
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Kept in step with `stock` by the pre-save hook below (and by the bulk
    // stock update), so restocking a sold-out product makes it buyable again.
    isInStock: {
      type: Boolean,
      default: false,
    },

    reviews: [reviewSchema],

    isFeatured: {
      type: Boolean,
      default: false,
    },

    rating: {
      type: Number,
      default: 0,
    },

    numReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ isFeatured: 1 });
// One product per code. Partial (not sparse) so products without one yet
// don't clash.
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: "string" } } });
productSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });

productSchema.pre("save", function syncIsInStock(next) {
  if (this.isNew || this.isModified("stock")) {
    this.isInStock = this.stock > 0;
  }
  next();
});

export default mongoose.model("Product", productSchema);
