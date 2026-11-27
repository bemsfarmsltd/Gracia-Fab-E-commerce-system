import Product from "../models/Product.js";
import { checkBarcode, findByCode, barcodeType, assignSku } from "../services/barcodes.js";
import { sendServerError } from "../utils/httpErrors.js";

// @desc   Find a product by a scanned or typed code (barcode or SKU)
// @route  GET /api/admin/products/lookup?code=
export const lookupProduct = async (req, res) => {
  try {
    const code = String(req.query.code || "").slice(0, 60);
    const product = await findByCode(code);
    if (!product) return res.status(404).json({ message: `No product has the code "${code}". Check it, or give the product this barcode in Labels.` });
    res.json({ ...product, barcodeType: barcodeType(product.barcode) });
  } catch (error) {
    return sendServerError(res, error, "lookupProduct error");
  }
};

// @desc   Set a product's barcode to the manufacturer's (or back to its SKU
//         with { barcode: null })
// @route  PUT /api/admin/products/:id/barcode   { barcode }
export const setProductBarcode = async (req, res) => {
  try {
    if (!/^[0-9a-f]{24}$/.test(req.params.id)) return res.status(404).json({ message: "Product not found" });
    let product = await Product.findById(req.params.id).select("name sku barcode");
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!product.sku) product = await Product.findById((await assignSku(product._id))._id).select("name sku barcode");

    const before = product.barcode;
    let next;
    if (req.body.barcode === null || req.body.barcode === "") {
      next = product.sku;
    } else {
      const check = checkBarcode(req.body.barcode);
      if (!check.ok) return res.status(400).json({ message: check.message });
      next = check.code;
    }
    if (next !== before) {
      const taken = await Product.findOne({ _id: { $ne: product._id }, $or: [{ barcode: next }, { sku: next }] }).select("name").lean();
      if (taken) return res.status(409).json({ message: `"${taken.name}" already has the code ${next}.` });
      product.barcode = next;
      await product.save();
    }
    res.locals.activity = {
      targetType: "product",
      summary: `Barcode of "${product.name}" ${before || "none"} → ${product.barcode}`,
      changes: { barcode: { from: before ?? null, to: product.barcode } },
    };
    res.json({ _id: product._id, name: product.name, sku: product.sku, barcode: product.barcode, barcodeType: barcodeType(product.barcode) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Another product already has that code." });
    return sendServerError(res, error, "setProductBarcode error");
  }
};
