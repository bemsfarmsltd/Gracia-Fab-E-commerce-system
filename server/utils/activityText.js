// Helpers that turn admin changes into activity-log entries people can read.

export const naira = (n) => `₦${Math.round(Number(n) || 0).toLocaleString("en-NG")}`;

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// { field: { from, to } } for the fields that actually changed.
export function fieldChanges(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const from = before?.[f];
    const to = after?.[f];
    if (!same(from, to)) out[f] = { from: from ?? null, to: to ?? null };
  }
  return out;
}

const LABELS = { name: "name", price: "price", stock: "stock", category: "category", brand: "brand", isFeatured: "featured", image: "photo", secondaryImage: "second photo", description: "description" };

export function describeProductChanges(productName, changes) {
  const parts = Object.entries(changes).map(([field, { from, to }]) => {
    if (field === "price") return `price ${naira(from)} → ${naira(to)}`;
    if (field === "stock") return `stock ${from ?? 0} → ${to ?? 0}`;
    if (field === "isFeatured") return to ? "marked featured" : "no longer featured";
    if (["image", "secondaryImage", "description"].includes(field)) return `${LABELS[field]} changed`;
    return `${LABELS[field] || field} "${from ?? ""}" → "${to ?? ""}"`;
  });
  return parts.length ? `"${productName}": ${parts.join(", ")}` : `"${productName}": saved with no changes`;
}
