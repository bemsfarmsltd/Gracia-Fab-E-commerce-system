import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { naira } from "../../utils/receipt";
import "./AdminSuppliers.css";

// Owner only: suppliers, deliveries with costs, cost prices and margins, what
// to reorder, and profit. Functional first version (Claude Code);
// Antigravity owns the look.
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}
const lagosDate = (offsetDays = 0) => new Date(Date.now() + 3600 * 1000 - offsetDays * 86400000).toISOString().slice(0, 10);
const VIEWS = [["costs", "Costs & margins"], ["delivery", "Record a delivery"], ["reorder", "To reorder"], ["profit", "Profit"], ["suppliers", "Suppliers"]];

function Costs({ data, suppliers, onSave }) {
  const [q, setQ] = useState("");
  const rows = data.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="costs-summary">
        <p>Stock value at cost <strong>{naira(data.totals.stockValue)}</strong></p>
        <p>At selling price <strong>{naira(data.totals.retailValue)}</strong></p>
        {data.totals.withoutCost > 0 && <p className="costs-warn">{data.totals.withoutCost} product(s) in stock have no cost yet</p>}
      </div>
      <input className="costs-search" type="search" placeholder="Find a product" aria-label="Find a product" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Price</th><th>Cost</th><th>Margin</th><th>In stock</th><th>Stock value</th><th>Supplier</th><th>Reorder at</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id} className={p.needsReorder ? "costs-row-due" : ""}>
                <td>{p.name}</td>
                <td>{naira(p.price)}</td>
                <td>
                  <input
                    className="costs-input" inputMode="numeric" aria-label={`Cost of ${p.name}`} defaultValue={p.costPrice ?? ""} placeholder="—" key={`c${p._id}${p.costPrice}`}
                    onBlur={(e) => { const v = e.target.value.trim(); const n = v === "" ? null : parseInt(v, 10); if (v !== String(p.costPrice ?? "") && (n === null || Number.isInteger(n))) onSave(p, { costPrice: n }); }}
                  />
                </td>
                <td className={p.margin !== null && p.margin < 15 ? "costs-warn" : ""}>{p.margin === null ? "—" : `${p.margin}%`}</td>
                <td>{p.stock}</td>
                <td>{p.stockValue === null ? "—" : naira(p.stockValue)}</td>
                <td>
                  <select aria-label={`Supplier of ${p.name}`} value={p.supplier?._id || ""} onChange={(e) => onSave(p, { supplierId: e.target.value || null })}>
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="costs-input costs-small" inputMode="numeric" aria-label={`Reorder level of ${p.name}`} defaultValue={p.reorderLevel ?? ""} placeholder="—" key={`r${p._id}${p.reorderLevel}`}
                    onBlur={(e) => { const v = e.target.value.trim(); const n = v === "" ? null : parseInt(v, 10); if (v !== String(p.reorderLevel ?? "") && (n === null || Number.isInteger(n))) onSave(p, { reorderLevel: n }); }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
      <div className="delivery-head">
        <label>Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choose…</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
        <label>Invoice number (optional)<input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} /></label>
      </div>
      <input className="costs-search" type="search" placeholder="Add a product from this delivery" aria-label="Add a product" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <ul className="delivery-matches">
          {matches.map((p) => (
            <li key={p._id}><button type="button" onClick={() => { setLines((ls) => [...ls, { product: p, quantity: "", unitCost: p.lastCost ?? "" }]); setQ(""); }}>{p.name}</button></li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Quantity</th><th>Cost per unit (₦)</th><th>Line total</th><th aria-label="Remove"></th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.product._id}>
                  <td>{l.product.name}</td>
                  <td><input className="costs-input costs-small" inputMode="numeric" aria-label={`Quantity of ${l.product.name}`} value={l.quantity} onChange={(e) => set(l.product._id, { quantity: e.target.value.replace(/\D/g, "") })} /></td>
                  <td><input className="costs-input" inputMode="numeric" aria-label={`Unit cost of ${l.product.name}`} value={l.unitCost} onChange={(e) => set(l.product._id, { unitCost: e.target.value.replace(/\D/g, "") })} /></td>
                  <td>{naira((parseInt(l.quantity, 10) || 0) * (parseInt(l.unitCost, 10) || 0))}</td>
                  <td><button type="button" className="labels-link" onClick={() => setLines((ls) => ls.filter((x) => x.product._id !== l.product._id))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="delivery-total">Total <strong>{naira(total)}</strong></p>
      <button type="button" className="btn-admin-save" disabled={!valid || busy} onClick={save}>{busy ? "Saving…" : "Record delivery"}</button>
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
    <div>
      <div className="delivery-head">
        <label>From<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>To<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
      </div>
      {error && <p className="costs-warn">{error}</p>}
      {data && (
        <>
          <div className="costs-summary">
            <p>Sales <strong>{naira(data.totals.revenue)}</strong></p>
            <p>Discounts <strong>−{naira(data.totals.discounts)}</strong></p>
            <p>Cost of goods <strong>−{naira(data.totals.cost)}</strong></p>
            <p>Profit <strong>{naira(data.totals.profit)}</strong>{data.totals.margin !== null && ` (${data.totals.margin}%)`}</p>
          </div>
          {data.totals.unitsWithoutCost > 0 && <p className="costs-warn">{data.totals.unitsWithoutCost} unit(s) sold had no cost entered, so profit is overstated. Add their costs in Costs & margins.</p>}
          <p className="costs-muted">Delivery fees aren't included. Profit uses each item's cost at the moment it sold.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Sold (online / shop)</th><th>Sales</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.product}>
                    <td>{p.name}</td>
                    <td>{p.units} ({p.onlineUnits} / {p.shopUnits})</td>
                    <td>{naira(p.revenue)}</td>
                    <td>{p.unitsWithoutCost ? "missing" : naira(p.cost)}</td>
                    <td>{naira(p.profit)}</td>
                    <td>{p.margin === null ? "—" : `${p.margin}%`}</td>
                  </tr>
                ))}
                {data.products.length === 0 && <tr><td colSpan={6}>No sales in this period.</td></tr>}
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
    <>
      <form className="supplier-form" onSubmit={submit}>
        <label>Name<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Contact person<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
        <label>Phone<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="supplier-notes">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button type="submit" className="btn-admin-save">Add supplier</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Products</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s._id}>
                <td>{s.name}{s.notes ? <><br /><span className="costs-muted">{s.notes}</span></> : null}</td>
                <td>{s.contactName || "—"}{s.email ? <><br /><a href={`mailto:${s.email}`}>{s.email}</a></> : null}</td>
                <td>{s.phone ? <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a> : "—"}</td>
                <td>{s.products}</td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={4}>No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
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
      <div className="costs-tabs" role="tablist">
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={`costs-tab ${view === id ? "is-active" : ""}`} onClick={() => setView(id)}>
            {label}{id === "reorder" && dueCount ? ` (${dueCount})` : ""}
          </button>
        ))}
      </div>
      {!costing ? <p className="costs-muted">Loading…</p> : (
        <section className="costs-card">
          {view === "costs" && <Costs data={costing} suppliers={suppliers} onSave={saveCosting} />}
          {view === "delivery" && <Delivery suppliers={suppliers} products={products} onDone={recordDelivery} />}
          {view === "reorder" && (
            reorder.length === 0 ? <p className="costs-muted">Nothing needs reordering. Set a "Reorder at" level per product in Costs & margins to get reminders.</p> : reorder.map((g) => (
              <div key={g.supplier?._id || "none"} className="reorder-group">
                <h4>{g.supplier?.name || "No supplier set"}</h4>
                <ul>{g.products.map((p) => <li key={p._id}>{p.name}: {p.stock} left (reorder at {p.reorderLevel}){p.lastCost ? `, last cost ${naira(p.lastCost)}` : ""}</li>)}</ul>
              </div>
            ))
          )}
          {view === "profit" && <Profit />}
          {view === "suppliers" && <Suppliers suppliers={suppliers} onAdd={addSupplier} />}
        </section>
      )}
    </div>
  );
}
