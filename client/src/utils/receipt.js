import { STORE } from "./storeInfo";

export const naira = (n) => `₦${Math.round(Number(n) || 0).toLocaleString("en-NG")}`;

export const PAYMENT_LABELS = { cash: "Cash", transfer: "Bank transfer", card: "POS card" };

export const saleTime = (iso) =>
  new Date(iso).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  });

// Nigerian numbers to wa.me format: 0803 744 7068 / +234 803… → 2348037447068.
export function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return digits;
  return null;
}

export function receiptText(sale) {
  const lines = [
    `Gracia Fab: receipt ${sale.numberLabel}`,
    saleTime(sale.createdAt),
    "",
    ...sale.items.map((i) => `${i.quantity} × ${i.name}: ${naira(i.lineTotal)}`),
    "",
  ];
  if (sale.discount > 0) lines.push(`Subtotal: ${naira(sale.subtotal)}`, `Discount: −${naira(sale.discount)}`);
  lines.push(`Total: ${naira(sale.total)}`, `Paid by ${PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}`);
  if (sale.paymentMethod === "cash" && sale.change > 0) lines.push(`Change: ${naira(sale.change)}`);
  if (sale.pointsAwarded > 0) {
    lines.push("", `Loyalty points earned: +${sale.pointsAwarded}`);
    if (sale.customerPoints !== undefined) lines.push(`Your points balance: ${sale.customerPoints}`);
  }
  lines.push("", `Thank you for shopping with us. ${STORE.area}. ${STORE.phoneDisplay}`);
  return lines.join("\n");
}

export function receiptWhatsAppUrl(sale) {
  const to = whatsappNumber(sale.customerPhone);
  return to ? `https://wa.me/${to}?text=${encodeURIComponent(receiptText(sale))}` : null;
}
