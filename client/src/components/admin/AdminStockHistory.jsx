import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import "./AdminLogs.css";

// Every stock movement, shop-wide or for one product, plus recording a
// delivery, a customer return or a write-off. Owner and staff (stock.count).
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}
const lagosDate = (daysAgo = 0) => new Date(Date.now() + 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);
const when = (iso) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const signed = (n) => (n > 0 ? `+${n}` : String(n));

const RECORDABLE = [
  { id: "received", label: "Received from a supplier", sign: 1 },
  { id: "customer_return", label: "Returned by a customer", sign: 1 },
  { id: "damaged", label: "Damaged", sign: -1 },
  { id: "expired", label: "Expired", sign: -1 },
  { id: "lost", label: "Lost or missing", sign: -1 },
];
const SUMMARY = [
  { label: "Sold online", reasons: ["online_sale", "online_cancel"] },
  { label: "Sold in the shop", reasons: ["store_sale", "store_void"] },
  { label: "Received and returned", reasons: ["received", "customer_return"] },
  { label: "Written off", reasons: ["damaged", "expired", "lost"] },
  { label: "Count corrections", reasons: ["count", "correction"] },
];

function RecordForm({ product, onDone, setAdminError }) {
  const [reason, setReason] = useState("received");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = RECORDABLE.find((r) => r.id === reason);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api("/api/admin/stock/movements", {
        method: "POST",
        body: JSON.stringify({ productId: product._id, reason, quantity: parseInt(quantity, 10), ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      setQuantity(""); setNote("");
      onDone(res);
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="logs-record" onSubmit={submit}>
      <label>What happened
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {RECORDABLE.map((r) => <option key={r.id} value={r.id}>{r.label} ({r.sign > 0 ? "adds" : "takes off"})</option>)}
        </select>
      </label>
      <label>How many
        <input inputMode="numeric" required value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} placeholder="0" />
      </label>
      <label className="logs-record-note">Note (optional)
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={chosen.sign > 0 ? "e.g. invoice number" : "e.g. jar cracked"} />
      </label>
      <button type="submit" className="btn-admin-save" disabled={busy || !(parseInt(quantity, 10) > 0)}>
        {busy ? "Saving…" : chosen.sign > 0 ? `Add ${quantity || ""}`.trim() : `Take off ${quantity || ""}`.trim()}
      </button>
    </form>
  );
}

export default function AdminStockHistory({ productId: initialProductId, setAdminError, setAdminNotice }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(initialProductId || "");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [range, setRange] = useState({ from: lagosDate(30), to: lagosDate(0) });
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, reasons: {} });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setProductId(initialProductId || ""); }, [initialProductId]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    api("/api/admin/products").then((list) => setProducts(Array.isArray(list) ? list : list.products || [])).catch((err) => setAdminError?.(err.message));
  }, [setAdminError]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50", from: range.from, to: range.to });
      if (productId) q.set("product", productId);
      if (reason) q.set("reason", reason);
      const [list, sum] = await Promise.all([
        api(`/api/admin/stock/movements?${q}`),
        page === 1 ? api(`/api/admin/stock/summary?from=${range.from}&to=${range.to}`) : Promise.resolve(null),
      ]);
      setData((prev) => (page === 1 ? list : { ...list, items: [...prev.items, ...list.items] }));
      if (sum) setSummary(sum);
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [productId, reason, range, setAdminError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(1); }, [load]);

  const product = useMemo(() => products.find((p) => p._id === productId), [products, productId]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)).slice(0, 8) : [];
  }, [products, search]);
  const totals = useMemo(() => {
    const by = Object.fromEntries((summary?.byReason || []).map((r) => [r.reason, r.units]));
    return SUMMARY.map((s) => ({ label: s.label, units: s.reasons.reduce((t, r) => t + (by[r] || 0), 0) }));
  }, [summary]);

  const recorded = (res) => {
    setAdminNotice?.(`${res.movement?.reasonLabel || "Recorded"}: ${product.name} now has ${res.stock} in stock.`);
    setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, stock: res.stock } : p)));
    load(1);
  };

  return (
    <div className="logs">
      <section className="logs-card logs-filters">
        <div className="logs-product-pick">
          <label htmlFor="sh-product">Product</label>
          {product ? (
            <div className="logs-chosen">
              <span><strong>{product.name}</strong>{product.sku ? ` · ${product.sku}` : ""}</span>
              <button type="button" className="labels-link" onClick={() => setProductId("")}>Show all products</button>
            </div>
          ) : (
            <>
              <input id="sh-product" type="search" placeholder="All products. Type to choose one" value={search} onChange={(e) => setSearch(e.target.value)} />
              {matches.length > 0 && (
                <ul className="logs-matches">
                  {matches.map((p) => <li key={p._id}><button type="button" onClick={() => { setProductId(p._id); setSearch(""); }}>{p.name} <span className="logs-muted">· {p.stock ?? 0} in stock</span></button></li>)}
                </ul>
              )}
            </>
          )}
        </div>
        <label>Movement
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">All</option>
            <option value="in">Everything in (+)</option>
            <option value="out">Everything out (−)</option>
            {Object.entries(data.reasons || {}).filter(([k]) => k !== "opening").map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>To<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
      </section>

      {!product && summary && (
        <section className="logs-stats" aria-label="Units in this period">
          {totals.map((t) => (
            <div key={t.label} className="logs-stat">
              <span className="logs-stat-label">{t.label}</span>
              <span className={`logs-stat-value ${t.units > 0 ? "is-in" : t.units < 0 ? "is-out" : ""}`}>{signed(t.units)}</span>
            </div>
          ))}
        </section>
      )}

      {product && (
        <section className="logs-card logs-product">
          <div className="logs-product-head">
            <div>
              <p className="logs-eyebrow">In stock now</p>
              <p className="logs-big">{product.stock ?? 0}</p>
            </div>
            {data.reconciliation && (
              data.reconciliation.matches
                ? <p className="logs-ok">✓ Every change is accounted for</p>
                : <p className="logs-warn" role="alert">⚠ The history adds up to {data.reconciliation.movementsTotal}, but the count says {data.reconciliation.stock}. The count was changed outside the stock tools; do a stock take for this product.</p>
            )}
          </div>
          <h3 className="logs-heading">Record a delivery, return or write-off</h3>
          <RecordForm product={product} onDone={recorded} setAdminError={setAdminError} />
        </section>
      )}

      <section className="logs-card">
        <h3 className="logs-heading">{product ? `History of ${product.name}` : "All stock movements"} <span className="logs-muted">({data.total})</span></h3>
        {data.items.length === 0 && !loading && <p className="logs-muted">No stock movements in this period.</p>}
        <ul className="logs-list">
          {data.items.map((m) => (
            <li key={m._id} className="logs-row">
              <span className={`logs-change ${m.change > 0 ? "is-in" : "is-out"}`}>{signed(m.change)}</span>
              <div className="logs-row-main">
                <p className="logs-row-title">
                  {m.reasonLabel}
                  {!product && <> · <button type="button" className="labels-link logs-inline" onClick={() => setProductId(String(m.product))}>{m.productName}</button></>}
                </p>
                <p className="logs-muted">
                  {when(m.createdAt)}{m.actorName ? ` · ${m.actorName}` : ""}{m.orderNumber ? ` · order #${m.orderNumber}` : ""}{m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <span className="logs-balance" title="In stock after this">{m.balanceAfter}<span className="logs-muted"> left</span></span>
            </li>
          ))}
        </ul>
        {data.page < data.pages && (
          <button type="button" className="btn-admin-cancel" disabled={loading} onClick={() => load(data.page + 1)}>{loading ? "Loading…" : "Show more"}</button>
        )}
      </section>
    </div>
  );
}
