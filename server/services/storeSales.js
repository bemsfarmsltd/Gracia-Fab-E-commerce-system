import Product from "../models/Product.js";
import StoreSale, { saleNumber } from "../models/StoreSale.js";
import { nextNumber } from "../models/Counter.js";
import { changeStock } from "./stock.js";
import { STORE_PAYMENT_METHOD_IDS } from "../config/storeSales.js";
import logger from "../utils/logger.js";

export class SaleError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const naira = (n) => `₦${Math.round(n).toLocaleString("en-NG")}`;

// Rings up a sale. Prices come from the products (never from the till), and
// stock comes off the shared count at once. If any item has run out (e.g. it
// just sold online) nothing is sold and nothing is taken.
export async function createSale(input, actor) {
  const { paymentMethod, amountTendered, paymentReference, customerName, customerPhone, note } = input;
  const discount = Math.round(Number(input.discount) || 0);

  if (!STORE_PAYMENT_METHOD_IDS.includes(paymentMethod)) throw new SaleError("Choose how the customer paid");
  if (discount > 0 && !actor.isAdmin) throw new SaleError("Only the owner can give a discount", 403);
  if (discount > 0 && !input.discountReason) throw new SaleError("Say why you're giving a discount");

  // The same product scanned twice becomes one line.
  const qtyById = new Map();
  for (const { productId, quantity } of input.items) {
    qtyById.set(productId, (qtyById.get(productId) || 0) + quantity);
  }
  const products = await Product.find({ _id: { $in: [...qtyById.keys()] } }).select("name price stock").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const missing = [...qtyById.keys()].filter((id) => !byId.has(id));
  if (missing.length) throw new SaleError("A product in this sale no longer exists. Remove it and try again.", 400, { missing });

  const lines = [...qtyById].map(([id, quantity]) => {
    const p = byId.get(id);
    return { product: p._id, name: p.name, unitPrice: p.price, quantity, lineTotal: p.price * quantity };
  });
  const short = lines.filter((l) => (Number(byId.get(String(l.product)).stock) || 0) < l.quantity);
  if (short.length) {
    throw new SaleError(
      short.map((l) => `Only ${Number(byId.get(String(l.product)).stock) || 0} of "${l.name}" left`).join("; "),
      400,
      { short: short.map((l) => ({ product: l.product, name: l.name, available: Number(byId.get(String(l.product)).stock) || 0 })) },
    );
  }

  const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);
  if (discount > subtotal) throw new SaleError("The discount is more than the sale");
  const total = subtotal - discount;

  let tendered;
  let change;
  if (paymentMethod === "cash") {
    tendered = Math.round(Number(amountTendered ?? total));
    if (tendered < total) throw new SaleError(`The customer handed over ${naira(tendered)}, but the total is ${naira(total)}`);
    change = tendered - total;
  }

  const number = await nextNumber("storeSale");
  const sale = await StoreSale.create({
    number,
    items: lines,
    subtotal,
    discount,
    discountReason: discount > 0 ? input.discountReason : undefined,
    total,
    paymentMethod,
    amountTendered: tendered,
    change,
    paymentReference: paymentReference || undefined,
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    note: note || undefined,
    soldBy: actor._id,
    soldByName: actor.name,
    status: "processing",
  });

  // Take the stock. Someone may have bought the last one online a moment ago:
  // then put back what this sale took and stop.
  const taken = [];
  for (const line of lines) {
    const result = await changeStock({
      productId: line.product, change: -line.quantity, reason: "store_sale", sale: sale._id, actor, note: saleNumber(number),
    });
    if (!result) {
      for (const t of taken) {
        await changeStock({ productId: t.product, change: t.quantity, reason: "store_void", sale: sale._id, actor, note: `${saleNumber(number)} not completed: not enough stock` });
      }
      await StoreSale.deleteOne({ _id: sale._id });
      const now = await Product.findById(line.product).select("stock").lean();
      throw new SaleError(`Only ${Number(now?.stock) || 0} of "${line.name}" left. It may have just sold online.`, 409);
    }
    taken.push(line);
  }

  sale.status = "completed";
  await sale.save();
  return sale;
}

// Owner only: undo a completed sale and put the stock back.
export async function voidSale(id, { reason }, actor) {
  const sale = await StoreSale.findOneAndUpdate(
    { _id: id, status: "completed" },
    { $set: { status: "voided", voidedAt: new Date(), voidedBy: actor._id, voidedByName: actor.name, voidReason: reason } },
    { new: true },
  );
  if (!sale) {
    const exists = await StoreSale.exists({ _id: id });
    throw new SaleError(exists ? "This sale was already voided" : "Sale not found", exists ? 400 : 404);
  }
  for (const line of sale.items) {
    const back = await changeStock({ productId: line.product, change: line.quantity, reason: "store_void", sale: sale._id, actor, note: `${saleNumber(sale.number)} voided: ${reason}` });
    if (!back) logger.error({ sale: sale._id, product: line.product }, "Couldn't return stock for a voided sale (product deleted?)");
  }
  return sale;
}

// Totals for cash-up and reports: completed sales only.
export async function salesSummary(filter) {
  const rows = await StoreSale.aggregate([
    { $match: { ...filter, status: "completed" } },
    { $group: { _id: "$paymentMethod", sales: { $sum: 1 }, total: { $sum: "$total" }, units: { $sum: { $sum: "$items.quantity" } } } },
    { $sort: { _id: 1 } },
  ]);
  const byMethod = rows.map((r) => ({ method: r._id, sales: r.sales, total: r.total, units: r.units }));
  return {
    byMethod,
    sales: byMethod.reduce((t, r) => t + r.sales, 0),
    total: byMethod.reduce((t, r) => t + r.total, 0),
    units: byMethod.reduce((t, r) => t + r.units, 0),
  };
}
