// One definition of "can this product be bought?" for every page.
//
// A product only counts as in stock with a positive `stock` value. A missing
// value means nobody has counted it (older products in the live database have
// no `stock` field, and the shop API returns them as-is), so it's out of stock
// — the server refuses orders for it too.
export function isOutOfStock(product) {
  if (!product) return true;
  if (product.isInStock === false) return true;
  return !(Number(product.stock) > 0);
}

// Same number as server/config/inventory.js (admin low-stock alerts).
export const LOW_STOCK = 5;

// Customer-facing stock text, from the real count.
export function stockLabel(product) {
  if (isOutOfStock(product)) return "Out of stock";
  const n = Number(product.stock);
  return n <= LOW_STOCK ? `In stock · only ${n} left` : "In stock";
}
