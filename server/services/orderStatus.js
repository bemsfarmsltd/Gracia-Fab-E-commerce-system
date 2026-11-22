// Moving an order along (processing → shipped → delivered) and telling the
// customer. Shared by the single-order update and the admin's bulk update, so
// both send exactly the same emails and WhatsApp messages.
// Cancelling is NOT handled here: it has refunds and stock side effects and
// goes through services/orderCancel.js.
import Order from "../models/Order.js";
import { messages } from "./whatsappService.js";
import { emailTemplates } from "./emailService.js";
import { whatsappQueue, emailQueue, addToQueue } from "../queues/index.js";
import logger from "../utils/logger.js";

export class OrderStatusError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function advanceOrderStatus(orderId, status, note = "") {
  const order = await Order.findById(orderId).populate("user", "email");
  if (!order) throw new OrderStatusError("Order not found", 404);

  // The model's state machine refuses invalid moves (e.g. pending → shipped).
  try {
    order.advanceStatus(status, note);
  } catch (err) {
    throw new OrderStatusError(err.message);
  }
  await order.save();

  const phone = order.deliveryAddress?.phone;
  const name = order.deliveryAddress?.fullName || "Customer";
  const shortId = order._id.toString().slice(-8).toUpperCase();
  const email = order.user?.email;

  const notices = {
    shipped: { wa: () => messages.orderShipped(name, shortId), mail: () => emailTemplates.orderShipped(name, shortId) },
    delivered: { wa: () => messages.orderDelivered(name), mail: () => emailTemplates.orderDelivered(name) },
  };
  const notice = notices[status];
  if (notice) {
    const type = `order-${status}`;
    if (phone) {
      await addToQueue(whatsappQueue, type, { phone, message: notice.wa(), type });
    }
    if (email) {
      const template = notice.mail();
      await addToQueue(emailQueue, type, { to: email, subject: template.subject, html: template.html, type });
    }
  }

  logger.info({ orderId: order._id, status }, "Order status updated");
  return order;
}
