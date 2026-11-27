import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { naira } from "../../utils/receipt";
import "./AdminSuppliers.css";

// Owner only: suppliers, deliveries with costs, cost prices and margins, what
// to reorder, and profit.
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}
const lagosDate = (offsetDays = 0) => new Date(Date.now() + 3600 * 1000 - offsetDays * 86400000).toISOString().slice(0, 10);
const VIEWS = [["costs", "Costs & margins"], ["delivery", "Record a delivery"], ["reorder", "To reorder"], ["profit", "Profit"], ["suppliers", "Suppliers"]];

function MarginPill({ margin }) {
  if (margin === null || margin === undefined) {
    return <span className="costs-margin-pill is-empty">—</span>;
  }
  const tone = margin < 15 ? "low" : margin > 35 ? "high" : "mid";
  return <span className={`costs-margin-pill is-${tone}`}>{margin}%</span>;
}

function Costs({ data, suppliers, onSave }) {
  const [q, setQ] = useState("");
  const rows = data.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="costs-pane">
      <div className="costs-section-head">
        <span className="costs-eyebrow">Inventory Valuation</span>
        <h3 className="costs-heading">Costs &amp; margins</h3>
      </div>

      {/* 3 Stat Cards */}
      <div className="costs-stats-grid cols-3">
        <div className="costs-stat-card">
          <span className="costs-stat-label">Stock value at cost</span>
          <strong className="costs-stat-val">{naira(data.totals.stockValue)}</strong>
        </div>
        <div className="costs-stat-card">
          <span className="costs-stat-label">At selling price</span>
          <strong className="costs-stat-val">{naira(data.totals.retailValue)}</strong>
        </div>
        <div className={`costs-stat-card ${data.totals.withoutCost > 0 ? "is-warning" : "is-ok"}`}>
          <span className="costs-stat-label">Missing cost</span>
          <strong className="costs-stat-val">{data.totals.withoutCost}</strong>
          <span className="costs-stat-sub">
            {data.totals.withoutCost > 0
              ? `${data.totals.withoutCost} product(s) in stock have no cost yet`
              : "All stocked products have a cost"}
          </span>
        </div>
      </div>

      <input
        className="costs-search"
        type="search"
        placeholder="Find a product"
        aria-label="Find a product"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="costs-table-wrap">
        <table className="admin-table costs-responsive-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Margin</th>
              <th>In stock</th>
              <th>Stock value</th>
              <th>Supplier</th>
              <th>Reorder at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id} className={p.needsReorder ? "costs-row-due" : ""}>
                <td className="costs-cell-name" data-label="Product">
                  <span className="costs-prod-name">{p.name}</span>
                  {p.needsReorder && <span className="costs-due-badge">Reorder due</span>}
                </td>
                <td data-label="Price">{naira(p.price)}</td>
                <td data-label="Cost (₦)">
                  <input
                    className="costs-input"
                    inputMode="numeric"
                    aria-label={`Cost of ${p.name}`}
                    defaultValue={p.costPrice ?? ""}
                    placeholder="—"
                    key={`c${p._id}${p.costPrice}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      const n = v === "" ? null : parseInt(v, 10);
                      if (v !== String(p.costPrice ?? "") && (n === null || Number.isInteger(n))) onSave(p, { costPrice: n });
                    }}
                  />
                </td>
                <td data-label="Margin"><MarginPill margin={p.margin} /></td>
                <td data-label="In stock">{p.stock}</td>
                <td data-label="Stock value">{p.stockValue === null ? "—" : naira(p.stockValue)}</td>
                <td className="costs-cell-supplier" data-label="Supplier">
                  <select
                    aria-label={`Supplier of ${p.name}`}
                    value={p.supplier?._id || ""}
                    onChange={(e) => onSave(p, { supplierId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </td>
                <td data-label="Reorder at">
                  <input
                    className="costs-input costs-small"
                    inputMode="numeric"
                    aria-label={`Reorder level of ${p.name}`}
                    defaultValue={p.reorderLevel ?? ""}
                    placeholder="—"
                    key={`r${p._id}${p.reorderLevel}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      const n = v === "" ? null : parseInt(v, 10);
                      if (v !== String(p.reorderLevel ?? "") && (n === null || Number.isInteger(n))) onSave(p, { reorderLevel: n });
                    }}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="costs-empty-row">
                <td colSpan={8}>No products match "{q}".</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Delivery({ suppliers, products, onDone }) {
  const [supplierId, setSupplierId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState([]); // { product, quantity, unitCost }
  const [busy, setBusy] = useState(false);
  const matches = q.trim() ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) && !lines.some((l) => l.product._id === p._id)).slice(0, 10) : [];
  const total = lines.reduce((t, l) => t + (parseInt(l.quantity, 10) || 0) * (parseInt(l.unitCost, 10) || 0), 0);
  const valid = supplierId && lines.length && lines.every((l) => parseInt(l.quantity, 10) > 0 && /^\d+$/.test(String(l.unitCost)));
  const set = (id, patch) => setLines((ls) => ls.map((l) => (l.product._id === id ? { ...l, ...patch } : l)));

  const save = async () => {
    setBusy(true);
    try {
      const purchase = await onDone({
        supplierId, ...(invoiceRef.trim() ? { invoiceRef: invoiceRef.trim() } : {}),
        items: lines.map((l) => ({ productId: l.product._id, quantity: parseInt(l.quantity, 10), unitCost: parseInt(l.unitCost, 10) })),
      });
      if (purchase) { setLines([]); setInvoiceRef(""); }
    } finally {
      setBusy(false);
    }
  };

  if (!suppliers.length) return <p className="costs-muted">Add a supplier first (Suppliers tab).</p>;
  return (
    <div className="delivery">
      <div className="costs-section-head">
        <span className="costs-eyebrow">Stock Receiving</span>
        <h3 className="costs-heading">Record a delivery</h3>
      </div>

      <div className="delivery-head">
        <label>Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choose…</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
        <label>Invoice number (optional)<input value={invoiceRef} placeholder="e.g. INV-204" onChange={(e) => setInvoiceRef(e.target.value)} /></label>
      </div>
      <input className="costs-search" type="search" placeholder="Add a product from this delivery" aria-label="Add a product" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <ul className="delivery-matches">
          {matches.map((p) => (
            <li key={p._id}>
              <button type="button" onClick={() => { setLines((ls) => [...ls, { product: p, quantity: "", unitCost: p.lastCost ?? "" }]); setQ(""); }}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <div className="costs-table-wrap">
          <table className="admin-table costs-responsive-table">
            <thead><tr><th>Product</th><th>Quantity</th><th>Cost per unit (₦)</th><th>Line total</th><th aria-label="Remove"></th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.product._id}>
                  <td className="costs-cell-name" data-label="Product"><span className="costs-prod-name">{l.product.name}</span></td>
                  <td data-label="Quantity"><input className="costs-input costs-small" inputMode="numeric" aria-label={`Quantity of ${l.product.name}`} value={l.quantity} onChange={(e) => set(l.product._id, { quantity: e.target.value.replace(/\D/g, "") })} /></td>
                  <td data-label="Cost per unit (₦)"><input className="costs-input" inputMode="numeric" aria-label={`Unit cost of ${l.product.name}`} value={l.unitCost} onChange={(e) => set(l.product._id, { unitCost: e.target.value.replace(/\D/g, "") })} /></td>
                  <td data-label="Line total"><span className="costs-line-total">{naira((parseInt(l.quantity, 10) || 0) * (parseInt(l.unitCost, 10) || 0))}</span></td>
                  <td data-label="Action"><button type="button" className="costs-remove-link" onClick={() => setLines((ls) => ls.filter((x) => x.product._id !== l.product._id))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="delivery-footer">
        <p className="delivery-total">Total <strong>{naira(total)}</strong></p>
        <button type="button" className="costs-btn-primary" disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : "Record delivery"}
        </button>
      </div>
      <p className="costs-muted">Stock goes up straight away and each product's cost becomes the average of what's on the shelf.</p>
    </div>
  );
}

function Profit() {
  const [range, setRange] = useState({ from: lagosDate(30), to: lagosDate(0) });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/api/admin/reports/profit?from=${range.from}&to=${range.to}`).then(setData).catch((e) => setError(e.message));
  }, [range]);
  return (
    <div className="costs-pane">
      <div className="costs-section-head">
        <span className="costs-eyebrow">Financial Performance</span>
        <h3 className="costs-heading">Profit report</h3>
      </div>

      <div className="delivery-head">
        <label>From<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>To<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
      </div>
      {error && <p className="costs-warning-banner" role="alert">{error}</p>}
      {data && (
        <>
          <div className="costs-stats-grid cols-4">
            <div className="costs-stat-card">
              <span className="costs-stat-label">Sales</span>
              <strong className="costs-stat-val">{naira(data.totals.revenue)}</strong>
            </div>
            <div className="costs-stat-card">
              <span className="costs-stat-label">Discounts</span>
              <strong className="costs-stat-val">−{naira(data.totals.discounts)}</strong>
            </div>
            <div className="costs-stat-card">
              <span className="costs-stat-label">Cost of goods</span>
              <strong className="costs-stat-val">−{naira(data.totals.cost)}</strong>
            </div>
            <div className="costs-stat-card is-highlight">
              <span className="costs-stat-label">Profit</span>
              <strong className="costs-stat-val">{naira(data.totals.profit)}</strong>
              {data.totals.margin !== null && (
                <span className="costs-stat-sub">Margin {data.totals.margin}%</span>
              )}
            </div>
          </div>

          {data.totals.unitsWithoutCost > 0 && (
            <div className="costs-warning-banner" role="status">
              ⚠️ {data.totals.unitsWithoutCost} unit(s) sold had no cost entered, so profit is overstated. Add their costs in Costs &amp; margins.
            </div>
          )}

          <p className="costs-muted">Delivery fees aren't included. Profit uses each item's cost at the moment it sold.</p>

          <div className="costs-table-wrap">
            <table className="admin-table costs-responsive-table">
              <thead><tr><th>Product</th><th>Sold (online / shop)</th><th>Sales</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.product}>
                    <td className="costs-cell-name" data-label="Product"><span className="costs-prod-name">{p.name}</span></td>
                    <td data-label="Sold (online / shop)">{p.units} ({p.onlineUnits} / {p.shopUnits})</td>
                    <td data-label="Sales">{naira(p.revenue)}</td>
                    <td data-label="Cost">{p.unitsWithoutCost ? "missing" : naira(p.cost)}</td>
                    <td data-label="Profit"><strong>{naira(p.profit)}</strong></td>
                    <td data-label="Margin"><MarginPill margin={p.margin} /></td>
                  </tr>
                ))}
                {data.products.length === 0 && (
                  <tr className="costs-empty-row"><td colSpan={6}>No sales in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Suppliers({ suppliers, onAdd }) {
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", notes: "" });
  const submit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    if (await onAdd(body)) setForm({ name: "", contactName: "", phone: "", email: "", notes: "" });
  };
  return (
    <div className="costs-pane">
      <div className="costs-section-head">
        <span className="costs-eyebrow">Directory</span>
        <h3 className="costs-heading">Suppliers</h3>
      </div>

      <form className="supplier-form" onSubmit={submit}>
        <label>Name<input required minLength={2} placeholder="Supplier company" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Contact person<input placeholder="Optional" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
        <label>Phone<input inputMode="tel" placeholder="080…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input type="email" placeholder="Optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="supplier-notes">Notes<input placeholder="Lead time, terms…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button type="submit" className="costs-btn-primary">Add supplier</button>
      </form>

      <div className="costs-table-wrap">
        <table className="admin-table costs-responsive-table">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Products</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s._id}>
                <td className="costs-cell-name" data-label="Supplier">
                  <span className="costs-prod-name">{s.name}</span>
                  {s.notes && <span className="costs-muted">{s.notes}</span>}
                </td>
                <td data-label="Contact">
                  {s.contactName || "—"}
                  {s.email ? <><br /><a href={`mailto:${s.email}`}>{s.email}</a></> : null}
                </td>
                <td data-label="Phone">{s.phone ? <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a> : "—"}</td>
                <td data-label="Products">{s.products}</td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr className="costs-empty-row"><td colSpan={4}>No suppliers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminSuppliers({ setAdminError, setAdminNotice }) {
  const [view, setView] = useState("costs");
  const [costing, setCosting] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [reorder, setReorder] = useState([]);

  const load = useCallback(async () => {
    try {
      const [c, s, r] = await Promise.all([api("/api/admin/costing/products"), api("/api/admin/suppliers"), api("/api/admin/costing/reorder")]);
      setCosting(c); setSuppliers(s); setReorder(r.groups);
    } catch (err) {
      setAdminError?.(err.message);
    }
  }, [setAdminError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const products = useMemo(() => costing?.products || [], [costing]);
  const dueCount = reorder.reduce((t, g) => t + g.products.length, 0);

  const saveCosting = async (p, body) => {
    try {
      await api(`/api/admin/costing/products/${p._id}`, { method: "PUT", body: JSON.stringify(body) });
      setAdminError?.("");
      load();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };
  const recordDelivery = async (body) => {
    try {
      const purchase = await api("/api/admin/purchases", { method: "POST", body: JSON.stringify(body) });
      setAdminNotice?.(`Delivery from ${purchase.supplierName} recorded: ${purchase.items.length} product(s), ${naira(purchase.total)}. Stock and costs updated.`);
      load();
      return purchase;
    } catch (err) {
      setAdminError?.(err.message);
      return null;
    }
  };
  const addSupplier = async (body) => {
    try {
      const s = await api("/api/admin/suppliers", { method: "POST", body: JSON.stringify(body) });
      setAdminNotice?.(`Supplier ${s.name} added.`);
      load();
      return true;
    } catch (err) {
      setAdminError?.(err.message);
      return false;
    }
  };

  return (
    <div className="costs">
      {/* Segmented control tabs (scroll sideways inside their own row on phones) */}
      <div className="costs-tabs-shell">
        <div className="costs-tabs" role="tablist" aria-label="Suppliers and costs sections">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={`costs-tab ${view === id ? "is-active" : ""}`}
              onClick={() => setView(id)}
            >
              {label}{id === "reorder" && dueCount ? ` (${dueCount})` : ""}
            </button>
          ))}
        </div>
      </div>

      {!costing ? <p className="costs-muted">Loading…</p> : (
        <section className="costs-card">
          {view === "costs" && <Costs data={costing} suppliers={suppliers} onSave={saveCosting} />}
          {view === "delivery" && <Delivery suppliers={suppliers} products={products} onDone={recordDelivery} />}
          {view === "reorder" && (
            <div className="costs-pane">
              <div className="costs-section-head">
                <span className="costs-eyebrow">Restock Reminders</span>
                <h3 className="costs-heading">To reorder</h3>
              </div>
              {reorder.length === 0 ? (
                <p className="costs-muted">Nothing needs reordering. Set a "Reorder at" level per product in Costs &amp; margins to get reminders.</p>
              ) : (
                <div className="reorder-groups">
                  {reorder.map((g) => (
                    <div key={g.supplier?._id || "none"} className="reorder-group">
                      <h4>{g.supplier?.name || "No supplier set"}</h4>
                      <ul>
                        {g.products.map((p) => (
                          <li key={p._id}>
                            <strong>{p.name}</strong>: {p.stock} left (reorder at {p.reorderLevel}){p.lastCost ? `, last cost ${naira(p.lastCost)}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {view === "profit" && <Profit />}
          {view === "suppliers" && <Suppliers suppliers={suppliers} onAdd={addSupplier} />}
        </section>
      )}
    </div>
  );
}
