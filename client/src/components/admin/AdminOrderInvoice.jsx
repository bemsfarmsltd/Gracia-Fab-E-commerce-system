import { useEffect } from "react";
import GraciaLogo from "../GraciaLogo";
import { STORE } from "../../utils/storeInfo";

const formatDateLagos = (dateValue, includeTime = true) => {
  if (!dateValue) return "—";
  try {
    const opts = {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Lagos",
    };
    if (includeTime) {
      opts.hour = "2-digit";
      opts.minute = "2-digit";
    }
    return new Date(dateValue).toLocaleString("en-NG", opts);
  } catch {
    return String(dateValue);
  }
};

export default function AdminOrderInvoice({ order, formatPrice, onClose }) {
  useEffect(() => {
    if (!order) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [order, onClose]);

  if (!order) return null;

  const fmt =
    formatPrice ||
    ((val) =>
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0,
      }).format(val || 0));

  const shortId = (order._id || "").slice(-8).toUpperCase();
  const address = order.deliveryAddress || order.shippingAddress || {};
  const customerName = address.fullName || order.user?.name || "Customer";
  const customerEmail = order.user?.email || "";
  const customerPhone = address.phone || order.user?.phone || "";
  const streetLine = address.address || address.streetAddress || "";
  const cityState = [address.city, address.state].filter(Boolean).join(", ");

  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const computedItemsSubtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const price = Number(item.price) || 0;
    return sum + qty * price;
  }, 0);

  const subtotal =
    typeof order.itemsPrice === "number" ? order.itemsPrice : computedItemsSubtotal;
  const discount = Number(order.discount ?? order.voucher?.discount ?? 0);
  const voucherCode = order.voucher?.code || "";
  const delivery =
    typeof order.deliveryPrice === "number" ? order.deliveryPrice : 2500;
  const total =
    typeof order.totalPrice === "number"
      ? order.totalPrice
      : Math.max(0, subtotal - discount) + delivery;

  const monnifyRef =
    order.paymentResult?.transactionReference ||
    order.paymentResult?.reference ||
    order.paymentReference ||
    "";

  const paidDate = order.paidAt || order.paymentResult?.paidAt || null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="invoice-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice for order #${shortId}`}
      data-testid="admin-order-invoice"
    >
      <div
        className="invoice-modal-shell"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar (hidden on print) */}
        <div className="invoice-action-bar no-print">
          <div className="invoice-action-title">
            <span className="invoice-action-kicker">Order Receipt</span>
            <strong>#{shortId}</strong>
          </div>
          <div className="invoice-action-buttons">
            <button
              type="button"
              className="btn-invoice-print"
              onClick={handlePrint}
              data-testid="invoice-print-btn"
            >
              🖨 Print / Save PDF
            </button>
            <button
              type="button"
              className="btn-invoice-close"
              onClick={onClose}
              aria-label="Close invoice"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <article className="invoice-sheet">
          {/* Header: Store Brand + Invoice Title */}
          <header className="invoice-sheet-header">
            <div className="invoice-store-block">
              <GraciaLogo size="md" showText />
              <div className="invoice-store-details">
                <p>{STORE.area}</p>
                <p>Tel / WhatsApp: {STORE.phoneDisplay}</p>
                <p>Hours: {STORE.hoursShort} · www.graciafab.com</p>
              </div>
            </div>

            <div className="invoice-meta-block">
              <span className="invoice-doc-label">
                {order.isPaid ? "PAYMENT RECEIPT" : "ORDER INVOICE"}
              </span>
              <h2 className="invoice-number">#{shortId}</h2>
              <dl className="invoice-meta-list">
                <div>
                  <dt>Order Date:</dt>
                  <dd>{formatDateLagos(order.createdAt, false)}</dd>
                </div>
                <div>
                  <dt>Status:</dt>
                  <dd className="invoice-status-val">{order.status || "pending"}</dd>
                </div>
                <div>
                  <dt>Payment:</dt>
                  <dd className={order.isPaid ? "invoice-paid-text" : "invoice-unpaid-text"}>
                    {order.isPaid ? "Paid" : "Unpaid"}
                  </dd>
                </div>
              </dl>
            </div>
          </header>

          {/* Customer & Payment Details */}
          <section className="invoice-parties-grid">
            <div className="invoice-party-card">
              <h3 className="invoice-party-heading">Billed &amp; Delivered To</h3>
              <p className="invoice-party-name">{customerName}</p>
              {streetLine && <p className="invoice-party-line">{streetLine}</p>}
              {cityState && <p className="invoice-party-line">{cityState}</p>}
              {customerPhone && <p className="invoice-party-line">Phone: {customerPhone}</p>}
              {customerEmail && <p className="invoice-party-line">Email: {customerEmail}</p>}
            </div>

            <div className="invoice-party-card">
              <h3 className="invoice-party-heading">Payment Details</h3>
              <p className="invoice-party-line">
                <strong>Method:</strong>{" "}
                {order.paymentResult?.channel
                  ? `Monnify (${order.paymentResult.channel})`
                  : "Monnify"}
              </p>
              <p className="invoice-party-line">
                <strong>Paid Date:</strong>{" "}
                {order.isPaid && paidDate ? formatDateLagos(paidDate, true) : "Not yet paid"}
              </p>
              {monnifyRef && (
                <p className="invoice-party-line invoice-ref-line">
                  <strong>Monnify Ref:</strong>{" "}
                  <span className="invoice-ref-code">{monnifyRef}</span>
                </p>
              )}
              {order.refund?.status === "pending" && (
                <p className="invoice-party-line invoice-refund-note">
                  <strong>Refund Due:</strong> {fmt(order.refund.amount)}
                </p>
              )}
              {order.refund?.status === "refunded" && (
                <p className="invoice-party-line invoice-refund-done">
                  <strong>Refunded:</strong> {fmt(order.refund.amount)}
                  {order.refund.reference ? ` (Ref: ${order.refund.reference})` : ""}
                </p>
              )}
            </div>
          </section>

          {/* Items Table */}
          <section className="invoice-items-section">
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th className="col-item">Item Description</th>
                  <th className="col-qty">Qty</th>
                  <th className="col-price">Unit Price</th>
                  <th className="col-total">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="invoice-empty-items">
                      No line items recorded on this order.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = Number(item.quantity ?? item.qty ?? 1);
                    const unitPrice = Number(item.price) || 0;
                    return (
                      <tr key={item._id || `${item.name}-${index}`}>
                        <td className="col-item">
                          <span className="invoice-item-name">{item.name}</span>
                        </td>
                        <td className="col-qty">{qty}</td>
                        <td className="col-price">{fmt(unitPrice)}</td>
                        <td className="col-total">{fmt(unitPrice * qty)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>

          {/* Totals Breakdown (No Tax Line) */}
          <section className="invoice-totals-section">
            <div className="invoice-totals-box">
              <div className="invoice-total-row">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="invoice-total-row invoice-discount-row">
                  <span>
                    Voucher Discount{voucherCode ? ` (${voucherCode})` : ""}
                  </span>
                  <span>−{fmt(discount)}</span>
                </div>
              )}

              <div className="invoice-total-row">
                <span>Delivery</span>
                <span>{fmt(delivery)}</span>
              </div>

              <div className="invoice-total-row invoice-grand-total">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </section>

          {/* Receipt Footer */}
          <footer className="invoice-sheet-footer">
            <p className="invoice-thank-you">
              Thank you for shopping with Gracia Fab.
            </p>
            <p className="invoice-footer-sub">
              For delivery questions or in-store appointments, call or WhatsApp{" "}
              {STORE.phoneDisplay} ({STORE.hoursShort}).
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
