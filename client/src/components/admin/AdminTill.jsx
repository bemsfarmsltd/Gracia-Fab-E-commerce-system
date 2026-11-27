import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { STORE } from "../../utils/storeInfo";
import { naira, PAYMENT_LABELS, saleTime, receiptWhatsAppUrl } from "../../utils/receipt";
import { findProductByCode } from "../../utils/barcode";
import BarcodeScanner from "./BarcodeScanner";
import "./AdminTill.css";

// In-store till: pick products, take payment, stock comes off the shared
// count at once.
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});
const todayLagos = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function Receipt({ sale, onVoid, canVoid, onClose }) {
  const wa = receiptWhatsAppUrl(sale);
  return (
    <div className="till-receipt" aria-label={`Receipt ${sale.numberLabel}`}>
      <div className="till-receipt-header">
        <div>
          <span className="till-eyebrow">In-Store Receipt</span>
          <h3 className="till-heading">{sale.numberLabel}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            className="till-receipt-close"
            onClick={onClose}
            aria-label="Close receipt"
          >
            ✕
          </button>
        )}
      </div>

      <div className="till-receipt-paper">
        <p className="till-receipt-brand">GRACIA FAB</p>
        <p className="till-receipt-small">{STORE.area}<br />{STORE.phoneDisplay}</p>
        <p className="till-receipt-small">Receipt {sale.numberLabel}<br />{saleTime(sale.createdAt)}<br />Served by {sale.soldByName}</p>
        {sale.status === "voided" && <p className="till-receipt-void">VOIDED: {sale.voidReason}</p>}
        <table className="till-receipt-lines">
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.product}>
                <td>{i.quantity} × {i.name}<br /><span className="till-receipt-small">{naira(i.unitPrice)} each</span></td>
                <td className="num">{naira(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sale.discount > 0 && (
          <>
            <p className="till-receipt-row"><span>Subtotal</span><span>{naira(sale.subtotal)}</span></p>
            <p className="till-receipt-row"><span>Discount ({sale.discountReason})</span><span>−{naira(sale.discount)}</span></p>
          </>
        )}
        <p className="till-receipt-row till-receipt-total"><span>Total</span><span>{naira(sale.total)}</span></p>
        <p className="till-receipt-row"><span>Paid by</span><span>{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</span></p>
        {sale.paymentMethod === "cash" && (
          <>
            <p className="till-receipt-row"><span>Cash given</span><span>{naira(sale.amountTendered)}</span></p>
            <p className="till-receipt-row"><span>Change</span><span>{naira(sale.change)}</span></p>
          </>
        )}
        {sale.paymentReference && <p className="till-receipt-row"><span>Reference</span><span>{sale.paymentReference}</span></p>}
        {sale.customerName && <p className="till-receipt-small">Customer: {sale.customerName}</p>}
        <p className="till-receipt-small till-receipt-thanks">Thank you for shopping with us.</p>
      </div>

      <div className="till-receipt-actions">
        <button type="button" className="till-btn-primary" onClick={() => window.print()}>Print</button>
        {wa && <a className="till-btn-outline" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
        {canVoid && sale.status === "completed" && onVoid && (
          <button type="button" className="till-btn-danger" onClick={() => onVoid(sale)}>Void sale</button>
        )}
        {onClose && (
          <button type="button" className="till-btn-ghost" onClick={onClose}>New sale</button>
        )}
      </div>
    </div>
  );
}

export default function AdminTill({ setAdminError, setAdminNotice }) {
  const [products, setProducts] = useState([]);
  const [options, setOptions] = useState({ paymentMethods: [], canDiscount: false, canVoid: false });
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [method, setMethod] = useState("");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [discount, setDiscount] = useState({ amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [today, setToday] = useState({ items: [], summary: null });
  const [scanning, setScanning] = useState(false);
  // Phones: is the payment section on screen? If not, a slim pay bar shows
  // the total at the bottom with a button that jumps to it.
  const [checkoutInView, setCheckoutInView] = useState(true);
  useEffect(() => {
    const el = document.querySelector(".till-checkout-bar");
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setCheckoutInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const d = todayLagos();
      const [list, summary] = await Promise.all([
        api(`/api/admin/sales?from=${d}&to=${d}&limit=100`),
        api(`/api/admin/sales/summary?from=${d}&to=${d}`),
      ]);
      setToday({ items: list.items, summary });
    } catch (err) {
      setAdminError?.(err.message);
    }
  }, [setAdminError]);

  const loadProducts = useCallback(async () => {
    try {
      const list = await api("/api/admin/products");
      setProducts(Array.isArray(list) ? list : list.products || []);
    } catch (err) {
      setAdminError?.(err.message);
    }
  }, [setAdminError]);

  useEffect(() => {
    api("/api/admin/sales/options").then(setOptions).catch((err) => setAdminError?.(err.message));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
    loadToday();
  }, [loadProducts, loadToday, setAdminError]);

  useEffect(() => {
    if (!lastSale) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLastSale(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastSale]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q))
      .sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [products, search]);

  const inCart = (id) => cart.find((l) => l.product._id === id)?.quantity || 0;
  const add = (p) => {
    if (inCart(p._id) >= (p.stock || 0)) return setAdminError?.(`Only ${p.stock || 0} of "${p.name}" in stock.`);
    setAdminError?.("");
    setCart((c) => (c.some((l) => l.product._id === p._id)
      ? c.map((l) => (l.product._id === p._id ? { ...l, quantity: l.quantity + 1 } : l))
      : [...c, { product: p, quantity: 1 }]));
  };
  // A scanned or typed code: add that product straight away. Handheld
  // scanners type the code and press Enter, so they land here too.
  const addByCode = (code) => {
    const p = findProductByCode(products, code);
    if (!p) {
      setAdminError?.(`No product has the code "${String(code).trim()}". Check it, or set it in Labels.`);
      return false;
    }
    add(p);
    setSearch("");
    return true;
  };
  const onScanned = useCallback((code) => {
    setScanning(false);
    addByCode(code);
  }, [products, cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQty = (id, q) => setCart((c) => c.flatMap((l) => {
    if (l.product._id !== id) return [l];
    const quantity = Math.max(0, Math.min(q, l.product.stock || 0));
    return quantity ? [{ ...l, quantity }] : [];
  }));

  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((t, l) => t + l.product.price * l.quantity, 0);
  const discountAmount = options.canDiscount ? Math.min(subtotal, Math.max(0, parseInt(discount.amount, 10) || 0)) : 0;
  const total = subtotal - discountAmount;
  const cashGiven = parseInt(tendered, 10);
  const change = method === "cash" && cashGiven >= total ? cashGiven - total : null;
  const canComplete = cart.length > 0 && method && (method !== "cash" || cashGiven >= total) && (!discountAmount || discount.reason.trim());

  const reset = () => {
    setCart([]); setMethod(""); setTendered(""); setReference("");
    setCustomer({ name: "", phone: "" }); setDiscount({ amount: "", reason: "" }); setSearch("");
  };

  const complete = async () => {
    setBusy(true);
    setAdminError?.("");
    try {
      const sale = await api("/api/admin/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.product._id, quantity: l.quantity })),
          paymentMethod: method,
          ...(method === "cash" ? { amountTendered: cashGiven } : {}),
          ...(reference.trim() ? { paymentReference: reference.trim() } : {}),
          ...(customer.name.trim() ? { customerName: customer.name.trim() } : {}),
          ...(customer.phone.trim() ? { customerPhone: customer.phone.trim() } : {}),
          ...(discountAmount ? { discount: discountAmount, discountReason: discount.reason.trim() } : {}),
        }),
      });
      setLastSale(sale);
      setAdminNotice?.(`Sale ${sale.numberLabel} done: ${naira(sale.total)}${sale.change ? `, give ${naira(sale.change)} change` : ""}.`);
      reset();
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setBusy(false);
      loadProducts();
      loadToday();
    }
  };

  const voidSale = async (sale) => {
    const reason = window.prompt(`Void sale ${sale.numberLabel} (${naira(sale.total)})? The stock goes back on the shelf. Why?`);
    if (!reason || reason.trim().length < 3) return;
    try {
      const updated = await api(`/api/admin/sales/${sale._id}/void`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      setAdminNotice?.(`Sale ${updated.numberLabel} voided; stock put back.`);
      if (lastSale?._id === updated._id) setLastSale(updated);
      loadProducts();
      loadToday();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  return (
    <div className="till">
      {/* ── COLUMN 1: PRODUCT PICKER & BARCODE SCAN ── */}
      <section className="till-card till-pick" aria-label="Products">
        <div className="till-sticky-search">
          <div className="till-card-head">
            <span className="till-eyebrow">Counter Catalogue</span>
            <label htmlFor="till-search" className="till-heading">Find or scan a product</label>
          </div>
          <div className="till-search-row">
            <input
              id="till-search" className="till-search" type="search" autoComplete="off" enterKeyHint="go"
              placeholder="Name, brand or barcode" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                // A code goes straight in; a name with one match adds it too.
                if (!search.trim()) return;
                if (findProductByCode(products, search)) { addByCode(search); return; }
                if (matches.length === 1 && matches[0].stock > 0) { setAdminError?.(""); add(matches[0]); setSearch(""); return; }
                if (matches.length === 0) addByCode(search); // explains "no product has the code"
              }}
            />
            <button type="button" className="till-scan-btn" onClick={() => setScanning(true)}>📷 Scan</button>
          </div>
        </div>
        {scanning && <BarcodeScanner onCode={onScanned} onClose={() => setScanning(false)} />}
        <ul className="till-products">
          {matches.map((p) => {
            const qty = inCart(p._id);
            const stockTone = !(p.stock > 0) ? "out" : p.stock <= 5 ? "low" : "ok";
            return (
              <li key={p._id}>
                <button
                  type="button"
                  className={`till-product ${qty > 0 ? "is-in-cart" : ""}`}
                  onClick={() => add(p)}
                  disabled={!(p.stock > 0)}
                >
                  <span className="till-product-top">
                    <span className="till-product-name">{p.name}</span>
                    {qty > 0 && <span className="till-in-cart-badge">×{qty}</span>}
                  </span>
                  <span className="till-product-bottom">
                    <span className="till-product-price">{naira(p.price)}</span>
                    <span className={`till-stock-pill is-${stockTone}`}>
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {matches.length === 0 && <li className="till-empty">No products match "{search}".</li>}
        </ul>
      </section>

      {/* ── COLUMN 2: CURRENT SALE + STICKY CHECKOUT BAR ── */}
      <section className="till-card till-cart" aria-label="Sale">
        <div className="till-card-head till-sale-head">
          <div>
            <span className="till-eyebrow">Active Basket</span>
            <h3 className="till-heading">This sale</h3>
          </div>
          {itemCount > 0 && (
            <span className="till-count-pill">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          )}
        </div>

        <div className="till-lines-wrap">
          {cart.length === 0 && <p className="till-empty">Tap products to add them.</p>}
          {cart.map((l) => (
            <div className="till-line" key={l.product._id}>
              <div className="till-line-info">
                <span className="till-line-name">{l.product.name}</span>
                <span className="till-product-meta">{naira(l.product.price)} each</span>
              </div>
              <span className="till-qty">
                <button type="button" aria-label={`One less ${l.product.name}`} onClick={() => setQty(l.product._id, l.quantity - 1)}>−</button>
                <span className="till-qty-val" aria-label="Quantity">{l.quantity}</span>
                <button type="button" aria-label={`One more ${l.product.name}`} onClick={() => setQty(l.product._id, l.quantity + 1)} disabled={l.quantity >= l.product.stock}>+</button>
              </span>
              <span className="till-line-total">{naira(l.product.price * l.quantity)}</span>
            </div>
          ))}
        </div>

        {options.canDiscount && cart.length > 0 && (
          <div className="till-row2 till-extra-field">
            <label>Discount (₦)<input inputMode="numeric" value={discount.amount} onChange={(e) => setDiscount({ ...discount, amount: e.target.value.replace(/\D/g, "") })} /></label>
            {discountAmount > 0 && <label>Reason<input value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} /></label>}
          </div>
        )}

        <details className="till-customer">
          <summary>Customer details (optional, for a WhatsApp receipt)</summary>
          <div className="till-row2">
            <label>Name<input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label>
            <label>Phone<input inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label>
          </div>
        </details>

        {/* Sticky bottom checkout bar on phones: total + payment + Complete sale always in thumb reach */}
        <div className="till-checkout-bar">
          <p className="till-total">
            <span className="till-total-label">Total</span>
            <span className="till-total-amount">{naira(total)}</span>
          </p>

          <div className="till-methods" role="radiogroup" aria-label="Payment method">
            {options.paymentMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={method === m.id}
                className={`till-method ${method === m.id ? "is-active" : ""}`}
                onClick={() => setMethod(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <div className="till-row2 till-cash-row">
              <label>Cash given (₦)<input inputMode="numeric" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))} /></label>
              <p className={`till-change ${change !== null ? "is-ok" : tendered ? "is-short" : ""}`}>
                {change !== null ? <>Change: <strong>{naira(change)}</strong></> : tendered ? "Not enough" : ""}
              </p>
            </div>
          )}
          {(method === "transfer" || method === "card") && (
            <label className="till-block">Reference (optional)<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
          )}

          <div className="till-checkout-actions">
            <button type="button" className="till-btn-primary till-complete" disabled={!canComplete || busy} onClick={complete}>
              {busy ? "Saving…" : `Complete sale${cart.length ? ` · ${naira(total)}` : ""}`}
            </button>
            {cart.length > 0 && (
              <button type="button" className="till-btn-ghost till-clear" onClick={reset}>Clear</button>
            )}
          </div>
        </div>
      </section>

      {/* Phones: total and a Pay button always at hand while the sale has items. */}
      {itemCount > 0 && !checkoutInView && (
        <div className="till-paybar" role="region" aria-label="Sale total">
          <span className="till-paybar-text">{itemCount} item{itemCount === 1 ? "" : "s"} · <strong>{naira(total)}</strong></span>
          <button
            type="button"
            className="till-paybar-btn"
            onClick={() => document.querySelector(".till-checkout-bar")?.scrollIntoView({ behavior: "smooth", block: "end" })}
          >
            Pay
          </button>
        </div>
      )}

      {/* ── COLUMN 3: TODAY'S CASH-UP & HISTORY ── */}
      <section className="till-card till-side" aria-label="Receipt and today's sales">
        <div className="till-card-head">
          <span className="till-eyebrow">Daily Cash-Up</span>
          <h3 className="till-heading">{options.canVoid ? "Today's shop sales" : "My sales today"}</h3>
        </div>
        {today.summary && (
          <ul className="till-cashup">
            {today.summary.byMethod.map((m) => (
              <li key={m.method}>
                <span>{PAYMENT_LABELS[m.method] || m.method} ({m.sales})</span>
                <span className="till-cashup-val">{naira(m.total)}</span>
              </li>
            ))}
            <li className="till-cashup-total">
              <span>Total ({today.summary.sales} sale{today.summary.sales === 1 ? "" : "s"})</span>
              <span>{naira(today.summary.total)}</span>
            </li>
          </ul>
        )}
        <ul className="till-history">
          {today.items.map((s) => (
            <li key={s._id}>
              <button type="button" className="till-history-item" onClick={() => setLastSale(s)}>
                <span className="till-history-meta">
                  <strong>{s.numberLabel}</strong>
                  <span>{saleTime(s.createdAt).split(", ").pop()}</span>
                </span>
                <span className={`till-history-total ${s.status === "voided" ? "is-voided" : ""}`}>
                  {s.status === "voided" ? "Voided" : naira(s.total)}
                </span>
              </button>
            </li>
          ))}
          {today.items.length === 0 && <li className="till-empty">No sales yet today.</li>}
        </ul>
      </section>

      {/* ── RECEIPT SHEET / MODAL (opens above the fold on phones & desktop) ── */}
      {lastSale && (
        <div className="till-receipt-backdrop" onClick={() => setLastSale(null)}>
          <div className="till-receipt-sheet" onClick={(e) => e.stopPropagation()}>
            <Receipt
              sale={lastSale}
              canVoid={options.canVoid}
              onVoid={voidSale}
              onClose={() => setLastSale(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
