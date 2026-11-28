import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { DEFAULT_CATEGORIES } from "../config/categories.js";

// "Face wash & cleansers" → "face-wash-cleansers"
export const slugify = (name) =>
  String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "category";

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Writes the starter list into an empty database, and makes sure every
// department a product already uses exists, so no product is left in a
// department the admin can't see. Safe to call on every request: it's one
// cheap count once categories exist.
export async function ensureCategories() {
  if ((await Category.estimatedDocumentCount()) === 0) {
    const docs = [];
    DEFAULT_CATEGORIES.forEach((dept, d) => {
      docs.push({ name: dept.name, slug: dept.slug, parent: null, order: d });
      dept.children.forEach((name, c) => docs.push({ name, slug: slugify(name), parent: dept.slug, order: c }));
    });
    // Two requests at once may both try; the unique slug keeps one copy.
    await Category.insertMany(docs, { ordered: false }).catch((err) => {
      if (err?.code !== 11000 && !err?.writeErrors) throw err;
    });
  }
  const used = (await Product.distinct("category")).filter(Boolean);
  const known = new Set((await Category.find({ parent: null }).select("slug").lean()).map((c) => c.slug));
  const missing = used.filter((slug) => !known.has(slug));
  if (missing.length) {
    const last = await Category.findOne({ parent: null }).sort({ order: -1 }).select("order").lean();
    await Category.insertMany(
      missing.map((slug, i) => ({ name: capitalise(slug), slug, parent: null, order: (last?.order ?? 0) + 1 + i })),
      { ordered: false },
    ).catch((err) => {
      if (err?.code !== 11000 && !err?.writeErrors) throw err;
    });
  }
}

// A slug nobody has used yet: "serums", then "serums-2", ...
export async function freeSlug(name) {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; await Category.exists({ slug }); n += 1) slug = `${base}-${n}`;
  return slug;
}

// Departments, each with its categories, in the owner's order.
// counts: { department: {slug: n}, sub: {slug: n} } adds productCount.
export async function categoryTree({ includeHidden = false, counts = null } = {}) {
  await ensureCategories();
  const filter = includeHidden ? {} : { active: true };
  const all = await Category.find(filter).sort({ order: 1, name: 1 }).lean();
  const shape = (c) => ({
    _id: c._id,
    name: c.name,
    slug: c.slug,
    order: c.order,
    active: c.active,
    ...(counts ? { productCount: (c.parent ? counts.sub[c.slug] : counts.department[c.slug]) || 0 } : {}),
  });
  return all
    .filter((c) => !c.parent)
    .map((d) => ({ ...shape(d), children: all.filter((c) => c.parent === d.slug).map(shape) }));
}

export async function productCounts() {
  const [dept, sub] = await Promise.all([
    Product.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
    Product.aggregate([{ $match: { subcategory: { $nin: [null, ""] } } }, { $group: { _id: "$subcategory", n: { $sum: 1 } } }]),
  ]);
  return {
    department: Object.fromEntries(dept.map((r) => [r._id, r.n])),
    sub: Object.fromEntries(sub.map((r) => [r._id, r.n])),
  };
}

// Checks a product's department and category. Returns an error list in the
// same shape as middleware/validate.js, or null when they're fine.
// A hidden department or category can still be kept on a product.
export async function checkProductCategory({ category, subcategory }) {
  await ensureCategories();
  if (category !== undefined) {
    if (!(await Category.exists({ slug: category, parent: null }))) {
      return [{ path: "category", message: "Choose a department from the list" }];
    }
  }
  if (subcategory) {
    const sub = await Category.findOne({ slug: subcategory }).lean();
    if (!sub || !sub.parent) return [{ path: "subcategory", message: "Choose a category from the list" }];
    if (category !== undefined && sub.parent !== category) {
      return [{ path: "subcategory", message: "That category belongs to a different department" }];
    }
  }
  return null;
}
