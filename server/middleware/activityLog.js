import AdminActivity from "../models/AdminActivity.js";
import logger from "../utils/logger.js";

// Records every successful admin change (POST/PUT/PATCH/DELETE answered with
// 2xx) in the activity log, after the response is sent, so it never slows or
// breaks the change itself. Controllers can add detail with
//   res.locals.activity = { summary, changes, targetId, targetType }
// Anything not mapped below is still logged under its method and path.

const ACTIONS = [
  ["POST", "/products", "product.create", "product"],
  ["PUT", "/products/stock", "stock.bulk_update", "product"],
  ["POST", "/stock/movements", "stock.movement", "product"],
  ["PUT", "/products/:id", "product.update", "product"],
  ["DELETE", "/products/:id", "product.delete", "product"],
  ["POST", "/upload", "image.upload", "image"],
  ["PUT", "/orders/status", "order.bulk_status", "order"],
  ["PUT", "/orders/:id/cancel", "order.cancel", "order"],
  ["PUT", "/orders/:id/refund", "order.refund", "order"],
  ["PUT", "/orders/:id", "order.status", "order"],
  ["POST", "/customers/:id/notes", "customer.note_add", "customer"],
  ["DELETE", "/customers/:id/notes/:noteId", "customer.note_delete", "customer"],
  ["POST", "/bookings", "booking.create", "booking"],
  ["PUT", "/bookings/:id", "booking.update", "booking"],
  ["DELETE", "/bookings/:id", "booking.delete", "booking"],
  ["POST", "/vouchers", "voucher.create", "voucher"],
  ["PUT", "/vouchers/:id", "voucher.update", "voucher"],
  ["DELETE", "/vouchers/:id", "voucher.delete", "voucher"],
  ["POST", "/staff", "staff.add", "staff"],
  ["POST", "/staff/:id/resend-invite", "staff.resend_invite", "staff"],
  ["DELETE", "/staff/:id", "staff.remove", "staff"],
  // Messages and subscribers (routes/contactRoutes.js)
  ["PUT", "/:id", "message.status", "message"],
  ["DELETE", "/:id", "message.delete", "message"],
  ["DELETE", "/subscribers/:id", "subscriber.delete", "subscriber"],
];

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Never copied into the log.
const SECRET_OR_BULKY = /password|token|secret|otp|image|base64|data$/i;

// A short, safe copy of the request body for entries without detail.
function bodySummary(body) {
  if (!body || typeof body !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SECRET_OR_BULKY.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = `${v.length} item(s)`;
  }
  return Object.keys(out).length ? out : undefined;
}

export function describe(method, routePath) {
  const hit = ACTIONS.find(([m, p]) => m === method && p === routePath);
  if (hit) return { action: hit[2], targetType: hit[3] };
  return { action: `${method.toLowerCase()} ${routePath || "?"}`, targetType: undefined };
}

export default function activityLog(req, res, next) {
  if (!WRITE.has(req.method)) return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.user) return;
    const { action, targetType } = describe(req.method, req.route?.path);
    const extra = res.locals.activity || {};
    AdminActivity.create({
      actor: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      action,
      targetType: extra.targetType || targetType,
      targetId: extra.targetId || req.params?.id,
      summary: extra.summary,
      changes: extra.changes ?? bodySummary(req.body),
      ip: req.ip,
    }).catch((err) => logger.error({ err, action }, "Couldn't write the admin activity log"));
  });
  next();
}
