import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { STORE } from "../../utils/storeInfo";
import { naira, PAYMENT_LABELS, saleTime, receiptWhatsAppUrl } from "../../utils/receipt";
import { findProductByCode } from "../../utils/barcode";
import BarcodeScanner from "./BarcodeScanner";
import "./AdminTill.css";

// In-store till: pick products, take payment, stock comes off the shared
// count at once. Functional first version (Claude Code); Antigravity owns the
// look. Barcode scanning plugs into the search box later.
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

export function Receipt({ sale, onVoid, canVoid }) {
  const wa = receiptWhatsAppUrl(sale);
  return (
    <div className="till-receipt" aria-label={`Receipt ${sale.numberLabel}`}>
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
        <button type="button" className="btn-admin-cancel" onClick={() => window.print()}>Print</button>
        {wa && <a className="btn-admin-cancel" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
        {canVoid && sale.status === "completed" && onVoid && <button type="button" className="btn-admin-cancel" onClick={() => onVoid(sale)}>Void sale</button>}
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
      // On a phone the receipt sits below the sale: bring it into view.
      setTimeout(() => document.querySelector(".till-receipt")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
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
      <section className="till-pick" aria-label="Products">
        <label htmlFor="till-search" className="till-label">Find or scan a product</label>
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
          <button type="button" className="btn-admin-cancel till-scan" onClick={() => setScanning(true)}>📷 Scan</button>
        </div>
        {scanning && <BarcodeScanner onCode={onScanned} onClose={() => setScanning(false)} />}
        <ul className="till-products">
          {matches.map((p) => (
            <li key={p._id}>
              <button type="button" className="till-product" onClick={() => add(p)} disabled={!(p.stock > 0)}>
                <span className="till-product-name">{p.name}</span>
                <span className="till-product-meta">{naira(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="till-empty">No products match "{search}".</li>}
        </ul>
      </section>

      <section className="till-cart" aria-label="Sale">
        <h3 className="till-heading">This sale</h3>
        {cart.length === 0 && <p className="till-empty">Tap products to add them.</p>}
        {cart.map((l) => (
          <div className="till-line" key={l.product._id}>
            <span className="till-line-name">{l.product.name}<br /><span className="till-product-meta">{naira(l.product.price)} each</span></span>
            <span className="till-qty">
              <button type="button" aria-label={`One less ${l.product.name}`} onClick={() => setQty(l.product._id, l.quantity - 1)}>−</button>
              <span aria-label="Quantity">{l.quantity}</span>
              <button type="button" aria-label={`One more ${l.product.name}`} onClick={() => setQty(l.product._id, l.quantity + 1)} disabled={l.quantity >= l.product.stock}>+</button>
            </span>
            <span className="till-line-total">{naira(l.product.price * l.quantity)}</span>
          </div>
        ))}

        {options.canDiscount && cart.length > 0 && (
          <div className="till-row2">
            <label>Discount (₦)<input inputMode="numeric" value={discount.amount} onChange={(e) => setDiscount({ ...discount, amount: e.target.value.replace(/\D/g, "") })} /></label>
            {discountAmount > 0 && <label>Reason<input value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} /></label>}
          </div>
        )}

        <p className="till-total"><span>Total</span><span>{naira(total)}</span></p>

        <div className="till-methods" role="radiogroup" aria-label="Payment method">
          {options.paymentMethods.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={`till-method ${method === m.id ? "is-active" : ""}`} onClick={() => setMethod(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {method === "cash" && (
          <div className="till-row2">
            <label>Cash given (₦)<input inputMode="numeric" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))} /></label>
            <p className="till-change">{change !== null ? <>Change: <strong>{naira(change)}</strong></> : tendered ? "Not enough" : ""}</p>
          </div>
        )}
        {(method === "transfer" || method === "card") && (
          <label className="till-block">Reference (optional)<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        )}

        <details className="till-customer">
          <summary>Customer details (optional, for a WhatsApp receipt)</summary>
          <div className="till-row2">
            <label>Name<input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label>
            <label>Phone<input inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label>
          </div>
        </details>

        <button type="button" className="btn-admin-save till-complete" disabled={!canComplete || busy} onClick={complete}>
          {busy ? "Saving…" : `Complete sale${cart.length ? ` · ${naira(total)}` : ""}`}
        </button>
        {cart.length > 0 && <button type="button" className="btn-admin-cancel" onClick={reset}>Clear</button>}
      </section>

      <section className="till-side" aria-label="Receipt and today's sales">
        {lastSale && <Receipt sale={lastSale} canVoid={options.canVoid} onVoid={voidSale} />}
        <h3 className="till-heading">{options.canVoid ? "Today's shop sales" : "My sales today"}</h3>
        {today.summary && (
          <ul className="till-cashup">
            {today.summary.byMethod.map((m) => (
              <li key={m.method}><span>{PAYMENT_LABELS[m.method] || m.method} ({m.sales})</span><span>{naira(m.total)}</span></li>
            ))}
            <li className="till-cashup-total"><span>Total ({today.summary.sales} sale{today.summary.sales === 1 ? "" : "s"})</span><span>{naira(today.summary.total)}</span></li>
          </ul>
        )}
        <ul className="till-history">
          {today.items.map((s) => (
            <li key={s._id}>
              <button type="button" className="till-history-item" onClick={() => setLastSale(s)}>
                <span>{s.numberLabel} · {saleTime(s.createdAt).split(", ").pop()}</span>
                <span>{s.status === "voided" ? "Voided" : naira(s.total)}</span>
              </button>
            </li>
          ))}
          {today.items.length === 0 && <li className="till-empty">No sales yet today.</li>}
        </ul>
      </section>
    </div>
  );
}
