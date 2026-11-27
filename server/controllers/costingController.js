import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import {
  receivePurchase, setCosting, productsWithCosts, reorderList, profitReport, CostingError, isObjectId,
} from "../services/costing.js";
import { sendServerError } from "../utils/httpErrors.js";

const naira = (n) => `₦${Math.round(n || 0).toLocaleString("en-NG")}`;
const fail = (res, error, context) => {
  if (error instanceof CostingError) return res.status(error.status).json({ message: error.message });
  return sendServerError(res, error, context);
};
const LAGOS = 60 * 60 * 1000;
function period(q) {
  const to = q.to && !Number.isNaN(Date.parse(q.to)) ? new Date(new Date(q.to).getTime() + 86400000 - 1 - LAGOS) : new Date();
  const from = q.from && !Number.isNaN(Date.parse(q.from)) ? new Date(new Date(q.from).getTime() - LAGOS) : new Date(to.getTime() - 30 * 86400000);
  return { from, to };
}

// ── Suppliers
export const listSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find(req.query.all === "1" ? {} : { active: true }).sort({ name: 1 }).lean();
    const counts = await Product.aggregate([{ $match: { supplier: { $ne: null } } }, { $group: { _id: "$supplier", n: { $sum: 1 } } }]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json(suppliers.map((s) => ({ ...s, products: byId.get(String(s._id)) || 0 })));
  } catch (error) {
    return fail(res, error, "listSuppliers error");
  }
};

export const postSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.locals.activity = { targetType: "supplier", targetId: String(supplier._id), summary: `Added supplier ${supplier.name}` };
    res.status(201).json(supplier);
  } catch (error) {
    return fail(res, error, "postSupplier error");
  }
};

export const putSupplier = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Supplier not found" });
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.locals.activity = { targetType: "supplier", summary: `Updated supplier ${supplier.name}` };
    res.json(supplier);
  } catch (error) {
    return fail(res, error, "putSupplier error");
  }
};

// ── Deliveries (purchases)
export const postPurchase = async (req, res) => {
  try {
    const purchase = await receivePurchase(req.body, req.user);
    res.locals.activity = {
      targetType: "purchase",
      targetId: String(purchase._id),
      summary: `Delivery from ${purchase.supplierName}${purchase.invoiceRef ? ` (invoice ${purchase.invoiceRef})` : ""}: ${purchase.items.map((i) => `${i.quantity}× ${i.name} at ${naira(i.unitCost)}`).join(", ")}; total ${naira(purchase.total)}`,
      changes: { total: purchase.total, items: purchase.items.length },
    };
    res.status(201).json(purchase);
  } catch (error) {
    return fail(res, error, "postPurchase error");
  }
};

export const listPurchases = async (req, res) => {
  try {
    const filter = {};
    if (isObjectId(req.query.supplier)) filter.supplier = req.query.supplier;
    const items = await Purchase.find(filter).sort({ receivedAt: -1 }).limit(100).lean();
    res.json({ items });
  } catch (error) {
    return fail(res, error, "listPurchases error");
  }
};

// ── Costs per product
export const getCosting = async (req, res) => {
  try {
    res.json(await productsWithCosts());
  } catch (error) {
    return fail(res, error, "getCosting error");
  }
};

export const putCosting = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const product = await setCosting(req.params.id, req.body);
    const bits = [];
    if (req.body.costPrice !== undefined) bits.push(`cost ${req.body.costPrice === null ? "cleared" : naira(req.body.costPrice)}`);
    if (req.body.supplierId !== undefined) bits.push(`supplier ${product.supplier?.name || "none"}`);
    if (req.body.reorderLevel !== undefined) bits.push(`reorder at ${req.body.reorderLevel ?? "no reminder"}`);
    res.locals.activity = { targetType: "product", summary: `"${product.name}": ${bits.join(", ")}` };
    res.json(product);
  } catch (error) {
    return fail(res, error, "putCosting error");
  }
};

export const getReorder = async (req, res) => {
  try {
    res.json({ groups: await reorderList() });
  } catch (error) {
    return fail(res, error, "getReorder error");
  }
};

export const getProfit = async (req, res) => {
  try {
    res.json(await profitReport(period(req.query)));
  } catch (error) {
    return fail(res, error, "getProfit error");
  }
};
