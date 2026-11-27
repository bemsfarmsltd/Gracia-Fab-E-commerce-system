import Order from "../models/Order.js";
import { changeStock } from "./stock.js";
import User from "../models/User.js";
import Voucher from "../models/Voucher.js";
import { whatsappQueue, emailQueue, addToQueue } from "../queues/index.js";
import { emailTemplates } from "./emailService.js";
import { messages } from "./whatsappService.js";
import logger from "../utils/logger.js";

export class OrderCancelError extends Error {}

// Orders that haven't left the building yet. Once shipped, it's a return.
const CANCELLABLE = ["pending", "paid", "processing"];

const shortId = (order) => order._id.toString().slice(-8).toUpperCase();

// Same formula markOrderPaid uses to award points.
const pointsFor = (order) => Math.max(1, Math.floor(order.totalPrice * 0.01));

// Puts stock back (recorded in the stock history against the order). Copes
// with older products that have no stock field at all.
async function returnStock(items, { order, actor }) {
  for (const { product, quantity } of items) {
    if (!product || !(quantity > 0)) continue;
    await changeStock({ productId: product, change: quantity, reason: "online_cancel", order, actor });
  }
}

async function notifyCustomer(order, { email, whatsapp }) {
  const user = await User.findById(order.user).select("name email");
  const name = order.deliveryAddress?.fullName || user?.name || "Customer";
  const phone = order.deliveryAddress?.phone;
  const template = email(name);
  if (user?.email) {
    await addToQueue(emailQueue, template.type, { to: user.email, subject: template.subject, html: template.html, type: template.type });
  }
  if (phone) {
    await addToQueue(whatsappQueue, template.type, { phone, message: whatsapp(name), type: template.type });
  }
}

// Cancels an order that hasn't shipped. If it was paid:
//   - returns the stock payment took (stockCommitted; older orders without
//     it get all their items back, which is what was taken back then)
//   - frees its voucher use and takes back the loyalty points it earned
//   - records a refund of the order total as owed (sent in the Monnify
//     dashboard, then recorded with markRefunded)
// and tells the customer. The status change is a conditional update, so two
// simultaneous cancels can't return stock twice.
export async function cancelOrder(orderId, { reason, actor } = {}) {
  const current = await Order.findById(orderId);
  if (!current) throw new OrderCancelError("Order not found");
  if (current.status === "cancelled") throw new OrderCancelError("This order is already cancelled");
  if (!CANCELLABLE.includes(current.status)) {
    throw new OrderCancelError(
      `Order is already ${current.status} — it can't be cancelled now. Handle it as a return.`,
    );
  }

  const wasPaid = current.isPaid;
  const refund = wasPaid
    ? { status: "pending", amount: current.totalPrice }
    : { status: "none" };

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: CANCELLABLE } },
    {
      $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason, refund },
      $push: {
        statusHistory: {
          status: "cancelled",
          note: wasPaid
            ? `Cancelled: ${reason}. Refund of ₦${current.totalPrice.toLocaleString("en-NG")} due.`
            : `Cancelled: ${reason}.`,
        },
      },
    },
    { new: true },
  );
  if (!order) throw new OrderCancelError("This order was just changed by someone else — refresh and try again");

  if (wasPaid) {
    const taken = order.stockCommitted?.length
      ? order.stockCommitted
      : order.orderItems.map((i) => ({ product: i.product, quantity: i.quantity }));
    await returnStock(taken, { order: order._id, actor });

    if (order.voucher?.code) {
      await Voucher.updateOne({ code: order.voucher.code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    }

    const points = pointsFor(order);
    await User.updateOne({ _id: order.user }, [
      { $set: { loyaltyPoints: { $max: [0, { $subtract: [{ $ifNull: ["$loyaltyPoints", 0] }, points] }] } } },
    ]);
    await User.updateOne(
      { _id: order.user },
      { $push: { pointsHistory: { points: -points, reason: `Order #${shortId(order)} cancelled`, type: "reversal" } } },
    );
  }

  const id = shortId(order);
  const refundAmount = wasPaid ? order.totalPrice : null;
  await notifyCustomer(order, {
    email: (name) => ({ ...emailTemplates.orderCancelled(name, id, refundAmount), type: "order-cancelled" }),
    whatsapp: (name) => messages.orderCancelled(name, id, refundAmount),
  });

  logger.info({ orderId: order._id, wasPaid, reason }, "Order cancelled");
  return order;
}

// Records that the refund for a cancelled, paid order has been sent (in the
// Monnify dashboard), and tells the customer.
export async function markRefunded(orderId, { reference, note }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "cancelled", "refund.status": "pending" },
    {
      $set: {
        "refund.status": "refunded",
        "refund.reference": reference,
        "refund.note": note,
        "refund.refundedAt": new Date(),
      },
      $push: { statusHistory: { status: "cancelled", note: `Refund sent (ref ${reference})` } },
    },
    { new: true },
  );
  if (!order) {
    const existing = await Order.findById(orderId);
    if (!existing) throw new OrderCancelError("Order not found");
    if (existing.refund?.status === "refunded") throw new OrderCancelError("This refund is already recorded");
    throw new OrderCancelError("There's no refund due on this order");
  }

  const id = shortId(order);
  await notifyCustomer(order, {
    email: (name) => ({ ...emailTemplates.refundSent(name, id, order.refund.amount), type: "refund-sent" }),
    whatsapp: (name) => messages.refundSent(name, id, order.refund.amount),
  });

  logger.info({ orderId: order._id, reference }, "Refund recorded");
  return order;
}
