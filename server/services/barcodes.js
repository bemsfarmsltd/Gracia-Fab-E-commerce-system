import Product from "../models/Product.js";
import { nextNumber } from "../models/Counter.js";

// Product codes and barcodes.
// - Every product gets a shop code (SKU) like GF-000123. Unless it has a
//   manufacturer barcode, its barcode is the SKU, printed as Code 128.
// - A manufacturer barcode (EAN-13, UPC-A, EAN-8, GTIN-14) is checked with
//   its check digit, so a mistyped number is refused.

export const formatSku = (n) => `GF-${String(n).padStart(6, "0")}`;

// GS1 check digit (EAN-8/13, UPC-A, GTIN-14): weights 3,1,3,1… from the right,
// not counting the check digit itself.
export function gtinIsValid(digits) {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split("").reverse().map(Number);
  const sum = body.reduce((t, d, i) => t + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

const GTIN_TYPES = { 8: "EAN-8", 12: "UPC-A", 13: "EAN-13", 14: "GTIN-14" };

// { ok, code, type } or { ok: false, message }.
export function checkBarcode(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, message: "Enter a barcode" };
  const digits = raw.replace(/[\s-]/g, "");
  if (/^\d+$/.test(digits) && GTIN_TYPES[digits.length]) {
    return gtinIsValid(digits)
      ? { ok: true, code: digits, type: GTIN_TYPES[digits.length] }
      : { ok: false, message: `That ${GTIN_TYPES[digits.length]} number doesn't check out (last digit). Check it against the packaging.` };
  }
  // Anything else must be printable as Code 128.
  if (!/^[\x21-\x7E][\x20-\x7E]{2,38}[\x21-\x7E]$/.test(raw)) {
    return { ok: false, message: "Use 4 to 40 letters, numbers or symbols, or a 8, 12, 13 or 14-digit product barcode" };
  }
  return { ok: true, code: raw.toUpperCase(), type: "Code 128" };
}

export const barcodeType = (code) => {
  const c = String(code || "");
  return /^\d+$/.test(c) && GTIN_TYPES[c.length] && gtinIsValid(c) ? GTIN_TYPES[c.length] : "Code 128";
};

// Gives a product a SKU (and, if it has no barcode, uses the SKU as one).
// Only fills what's empty; safe to call again.
export async function assignSku(productId) {
  const product = await Product.findById(productId).select("sku barcode").lean();
  if (!product || product.sku) return product;
  const sku = formatSku(await nextNumber("productSku"));
  const set = { sku };
  if (!product.barcode) set.barcode = sku;
  return Product.findOneAndUpdate({ _id: productId, sku: { $exists: false } }, { $set: set }, { new: true }).lean();
}

// The product a scanned or typed code belongs to: its barcode, or its SKU
// typed in any case, with or without the dash.
export async function findByCode(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[\s-]/g, "");
  const upper = raw.toUpperCase();
  const skuLike = /^GF-?\d{1,6}$/.test(upper) ? formatSku(Number(upper.replace(/\D/g, ""))) : null;
  const or = [{ barcode: raw }, { barcode: upper }, { barcode: digits }];
  if (skuLike) or.push({ sku: skuLike }, { barcode: skuLike });
  return Product.findOne({ $or: or }).select("name price stock image sku barcode category brand").lean();
}
