// Barcode helpers shared by the till, labels and (later) stock-take.

// GS1 check digit (EAN-8/13, UPC-A, GTIN-14). Same rule as the server.
export function gtinIsValid(digits) {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split("").reverse().map(Number);
  const sum = body.reduce((t, d, i) => t + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

// The JsBarcode format to draw a code in.
export function barcodeFormat(code) {
  const c = String(code || "");
  if (/^\d{13}$/.test(c) && gtinIsValid(c)) return "EAN13";
  if (/^\d{12}$/.test(c) && gtinIsValid(c)) return "UPC";
  if (/^\d{8}$/.test(c) && gtinIsValid(c)) return "EAN8";
  return "CODE128";
}

// Normalised forms of a scanned/typed code, for matching against products:
// the code as scanned, upper-cased, without spaces/dashes, and the shop
// code written loosely ("gf12" → "GF-000012").
export function codeCandidates(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const set = new Set([raw, upper, raw.replace(/[\s-]/g, "")]);
  if (/^GF-?\d{1,6}$/.test(upper)) set.add(`GF-${upper.replace(/\D/g, "").padStart(6, "0")}`);
  return [...set];
}

// The product (from a loaded list) a code belongs to, or null.
export function findProductByCode(products, input) {
  const wanted = codeCandidates(input);
  if (!wanted.length) return null;
  return products.find((p) => wanted.includes(p.barcode) || wanted.includes(p.sku)) || null;
}

// Draws a barcode into an <svg> element. JsBarcode is loaded on demand so
// pages that never show a barcode don't download it.
export async function drawBarcode(svg, code, { height = 40, width = 1.6, fontSize = 12 } = {}) {
  if (!svg || !code) return;
  const { default: JsBarcode } = await import("jsbarcode");
  JsBarcode(svg, code, { format: barcodeFormat(code), height, width, fontSize, margin: 0, displayValue: true, background: "transparent" });
}
