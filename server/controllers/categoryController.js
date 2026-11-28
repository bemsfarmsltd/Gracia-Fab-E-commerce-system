import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { categoryTree, productCounts, freeSlug, ensureCategories } from "../services/categories.js";
import { sendServerError } from "../utils/httpErrors.js";

// @desc   Departments and their categories, for the shop (hidden ones left out)
// @route  GET /api/categories
export const getPublicCategories = async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300");
    res.json(await categoryTree());
  } catch (error) {
    return sendServerError(res, error, "getPublicCategories error");
  }
};

// @desc   Every department and category, hidden ones too, with product counts
//         and how many products in each department have no category yet
// @route  GET /api/admin/categories
export const getAdminCategories = async (req, res) => {
  try {
    const counts = await productCounts();
    const tree = await categoryTree({ includeHidden: true, counts });
    const unsortedAgg = await Product.aggregate([
      { $match: { $or: [{ subcategory: null }, { subcategory: "" }, { subcategory: { $exists: false } }] } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
    ]);
    const unsorted = Object.fromEntries(unsortedAgg.map((r) => [r._id, r.n]));
    res.json(tree.map((d) => ({ ...d, unsortedCount: unsorted[d.slug] || 0 })));
  } catch (error) {
    return sendServerError(res, error, "getAdminCategories error");
  }
};

// @desc   Add a department (no parent) or a category inside a department
// @route  POST /api/admin/categories  { name, parent? }
export const createCategory = async (req, res) => {
  try {
    await ensureCategories();
    const { name, parent = null } = req.body;
    if (parent && !(await Category.exists({ slug: parent, parent: null }))) {
      return res.status(400).json({ message: "That department doesn't exist" });
    }
    const nameTaken = await Category.exists({
      parent,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (nameTaken) {
      return res.status(409).json({ message: `"${name}" is already there` });
    }
    const last = await Category.findOne({ parent }).sort({ order: -1 }).select("order").lean();
    const category = await Category.create({ name, parent, slug: await freeSlug(name), order: (last?.order ?? -1) + 1 });
    res.locals.activity = {
      targetId: String(category._id),
      summary: parent ? `Added category "${name}" under ${parent}` : `Added department "${name}"`,
    };
    res.status(201).json(category);
  } catch (error) {
    return sendServerError(res, error, "createCategory error");
  }
};

// @desc   Rename, hide or show a department or category
// @route  PUT /api/admin/categories/:id  { name?, active? }
export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    const before = { name: category.name, active: category.active };
    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.active !== undefined) category.active = req.body.active;
    await category.save();
    const changes = {};
    if (before.name !== category.name) changes.name = { from: before.name, to: category.name };
    if (before.active !== category.active) changes.active = { from: before.active, to: category.active };
    res.locals.activity = {
      targetId: String(category._id),
      summary: `Changed ${category.parent ? "category" : "department"} "${category.name}"`,
      changes,
    };
    res.json(category);
  } catch (error) {
    return sendServerError(res, error, "updateCategory error");
  }
};

// @desc   Delete a department or category nothing uses
// @route  DELETE /api/admin/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    const field = category.parent ? "subcategory" : "category";
    const used = await Product.countDocuments({ [field]: category.slug });
    if (used) {
      return res.status(409).json({
        message: `${used} product${used === 1 ? " is" : "s are"} in "${category.name}". Move ${used === 1 ? "it" : "them"} first, or hide it instead.`,
      });
    }
    if (!category.parent && (await Category.exists({ parent: category.slug }))) {
      return res.status(409).json({ message: `Delete or move the categories inside "${category.name}" first, or hide it instead.` });
    }
    await category.deleteOne();
    res.locals.activity = { targetId: String(category._id), summary: `Deleted ${category.parent ? "category" : "department"} "${category.name}"` };
    res.json({ message: "Deleted" });
  } catch (error) {
    return sendServerError(res, error, "deleteCategory error");
  }
};

// @desc   Put departments, or the categories in one department, in this order
// @route  POST /api/admin/categories/reorder  { ids: [...] } (all siblings)
export const reorderCategories = async (req, res) => {
  try {
    const items = await Category.find({ _id: { $in: req.body.ids } }).select("parent").lean();
    if (items.length !== req.body.ids.length || new Set(items.map((c) => c.parent)).size !== 1) {
      return res.status(400).json({ message: "Reorder one department's categories (or the departments) at a time" });
    }
    await Category.bulkWrite(req.body.ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
    res.locals.activity = { summary: "Reordered categories" };
    res.json({ message: "Saved" });
  } catch (error) {
    return sendServerError(res, error, "reorderCategories error");
  }
};

// @desc   Put several products into one category (their department follows)
// @route  POST /api/admin/categories/assign  { productIds: [...], subcategory }
export const assignCategory = async (req, res) => {
  try {
    const sub = await Category.findOne({ slug: req.body.subcategory }).lean();
    if (!sub || !sub.parent) return res.status(400).json({ message: "Choose a category from the list" });
    const result = await Product.updateMany(
      { _id: { $in: req.body.productIds } },
      { $set: { subcategory: sub.slug, category: sub.parent } },
    );
    res.locals.activity = {
      targetType: "product",
      summary: `Put ${result.modifiedCount} product${result.modifiedCount === 1 ? "" : "s"} in "${sub.name}"`,
    };
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    return sendServerError(res, error, "assignCategory error");
  }
};
