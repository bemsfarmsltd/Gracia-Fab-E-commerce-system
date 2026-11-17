import Order from "../models/Order.js";
import { confirmOrderPayment } from "./orderPayment.js";
import { getMonnifyConfig } from "./monnify.js";
import logger from "../utils/logger.js";

export const UNPAID_ORDER_HOURS = 48;
export const EXPIRY_REASON = `Not paid within ${UNPAID_ORDER_HOURS} hours`;

// Cancels orders that were never paid, so they don't pile up in the admin
// list and reports. Stock isn't held for unpaid orders (it's taken at
// payment), so there's nothing to give back and no refund to record.
//
// Safety: if a payment was started, Monnify is asked first. A customer who
// paid but whose confirmation never arrived (closed tab, missed webhook) gets
// their order marked paid instead of cancelled. If Monnify can't be reached,
// the order is left for the next run.
//
// No message is sent to the customer: they never paid, and an email about
// a basket they abandoned two days ago would just be noise.
export async function expireUnpaidOrders({ now = new Date(), hours = UNPAID_ORDER_HOURS } = {}) {
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const stale = await Order.find({ status: "pending", isPaid: false, createdAt: { $lt: cutoff } });
  const monnifyReady = getMonnifyConfig().isConfigured;

  const result = { cancelled: 0, paid: 0, skipped: 0 };

  for (const order of stale) {
    if (order.paymentReference) {
      if (!monnifyReady) {
        result.skipped += 1;
        continue;
      }
      try {
        const check = await confirmOrderPayment(order);
        if (check.ok) {
          logger.warn({ orderId: order._id }, "Unpaid-order cleanup found a confirmed payment; marked paid");
          result.paid += 1;
          continue;
        }
      } catch (err) {
        logger.error({ err, orderId: order._id }, "Unpaid-order cleanup: could not check payment; will retry");
        result.skipped += 1;
        continue;
      }
    }

    // Conditional, so an order paid in the meantime is never cancelled.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", isPaid: false },
      {
        $set: { status: "cancelled", cancelledAt: now, cancelReason: EXPIRY_REASON, refund: { status: "none" } },
        $push: { statusHistory: { status: "cancelled", note: `Cancelled automatically: ${EXPIRY_REASON.toLowerCase()}.` } },
      },
    );
    if (updated) result.cancelled += 1;
    else result.skipped += 1;
  }

  if (stale.length > 0) logger.info(result, "Unpaid-order cleanup finished");
  return result;
}
