import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { can } from "../../utils/portal";
import BarcodeScanner from "./BarcodeScanner";
import "./AdminStockTake.css";

// Stock take: staff count (scan, or tap/type), the owner reviews the
// differences and approves.
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}
const when = (iso) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function DiffPill({ difference }) {
  const tone = difference < 0 ? "minus" : difference > 0 ? "plus" : "match";
  return (
    <span className={`stocktake-diff-pill is-${tone}`}>
      {difference === 0 ? "matches" : signed(difference)}
    </span>
  );
}

function Report({ take, onBack }) {
  const rows = (take.results || []).filter((r) => r.difference !== 0);
  return (
    <div className="stocktake">
      <section className="stocktake-card">
        <span className="stocktake-eyebrow">Stock Take Report</span>
        <h3 className="stocktake-heading">{take.name}: {take.status}</h3>
        <p className="stocktake-muted">
          {take.status === "completed"
            ? `Approved by ${take.completedByName} on ${when(take.completedAt)}. ${take.totals?.missingUnits || 0} missing, ${take.totals?.extraUnits || 0} extra, ${take.totals?.unchanged || 0} product(s) matched.${take.zeroedUncounted ? " Products nobody counted were set to 0." : ""}`
            : "Cancelled: no stock was changed."}
        </p>

        {take.status === "completed" && (
          <div className="stocktake-result-stats">
            <div className="stocktake-stat is-minus">
              <span className="stocktake-stat-label">Missing units</span>
              <strong className="stocktake-stat-val">{take.totals?.missingUnits || 0}</strong>
            </div>
            <div className="stocktake-stat is-plus">
              <span className="stocktake-stat-label">Extra units</span>
              <strong className="stocktake-stat-val">{take.totals?.extraUnits || 0}</strong>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="stocktake-lines">
            {rows.map((r) => (
              <li className="stocktake-line-row" key={String(r.product)}>
                <div className="stocktake-line-main">
                  <span className="stocktake-line-name">{r.name}</span>
                  <span className="stocktake-muted">
                    Counted {r.counted ?? "not counted"} · System {r.systemAtCount} · Now {r.stockAfter ?? "?"}
                  </span>
                  {r.note && <span className="stocktake-muted">{r.note}</span>}
                </div>
                <DiffPill difference={r.difference} />
              </li>
            ))}
          </ul>
        )}
        <div className="stocktake-actions">
          <button type="button" className="stocktake-btn-ghost" onClick={onBack}>Back</button>
        </div>
      </section>
    </div>
  );
}

export default function AdminStockTake({ user, setAdminError, setAdminNotice }) {
  const [take, setTake] = useState(null);
  const [past, setPast] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", category: "" });
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [scanTick, setScanTick] = useState(0);
  const [zeroUncounted, setZeroUncounted] = useState(false);
  const [report, setReport] = useState(null);
  const canApprove = can(user, "stocktake.approve");

  const load = useCallback(async () => {
    try {
      const [current, list, prods] = await Promise.all([
        api("/api/admin/stocktakes/current"),
        api("/api/admin/stocktakes"),
        api("/api/admin/products"),
      ]);
      setTake(current);
      setPast(list.items || []);
      setProducts(Array.isArray(prods) ? prods : prods.products || []);
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [setAdminError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const counted = useMemo(() => new Map((take?.lines || []).map((l) => [String(l.product), l])), [take]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => (!take?.category || p.category === take.category) && (p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))).slice(0, 12);
  }, [products, search, take]);

  const refresh = async () => setTake(await api("/api/admin/stocktakes/current"));

  const start = async (e) => {
    e.preventDefault();
    try {
      setTake(await api("/api/admin/stocktakes", { method: "POST", body: JSON.stringify({ name: form.name, ...(form.category ? { category: form.category } : {}) }) }));
      setAdminNotice?.(`Stock take "${form.name}" started. Scan or tap each item as you count it.`);
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  const scan = useCallback(async (value) => {
    if (!take || !String(value).trim()) return;
    try {
      const r = await api(`/api/admin/stocktakes/${take._id}/scan`, { method: "POST", body: JSON.stringify({ code: String(value).trim() }) });
      setLastScan(`${r.product.name}: ${r.counted} counted`);
      setScanTick((n) => n + 1);
      setAdminError?.("");
      refresh();
    } catch (err) {
      setLastScan(err.message);
      setScanTick((n) => n + 1);
      setAdminError?.(err.message);
    }
  }, [take]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeLine = async (productId, body) => {
    try {
      setTake(await api(`/api/admin/stocktakes/${take._id}/lines/${productId}`, { method: "PUT", body: JSON.stringify(body) }));
    } catch (err) {
      setAdminError?.(err.message);
    }
  };
  const removeLine = async (productId) => {
    try {
      setTake(await api(`/api/admin/stocktakes/${take._id}/lines/${productId}`, { method: "DELETE" }));
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  const approve = async () => {
    const t = take.totals;
    const extra = zeroUncounted && t.uncounted ? ` ${t.uncounted} product(s) nobody counted (${t.uncountedUnits} units) will be set to 0.` : "";
    if (!window.confirm(`Apply this stock take? ${t.missingUnits} unit(s) missing and ${t.extraUnits} extra will be recorded.${extra}`)) return;
    try {
      const done = await api(`/api/admin/stocktakes/${take._id}/complete`, { method: "POST", body: JSON.stringify({ zeroUncounted }) });
      setAdminNotice?.(`Stock take "${done.name}" applied.`);
      setTake(null);
      setReport(done);
      load();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };
  const cancel = async () => {
    if (!window.confirm("Cancel this stock take? Nothing will change.")) return;
    try {
      await api(`/api/admin/stocktakes/${take._id}/cancel`, { method: "POST" });
      setAdminNotice?.("Stock take cancelled. No stock changed.");
      setTake(null);
      load();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  if (loading) return <p className="stocktake-muted">Loading…</p>;
  if (report) return <Report take={report} onBack={() => setReport(null)} />;

  if (!take) {
    return (
      <div className="stocktake">
        <section className="stocktake-card">
          <span className="stocktake-eyebrow">Shelf Count</span>
          <h3 className="stocktake-heading">Start a stock take</h3>
          <p className="stocktake-muted">Count what's on the shelf. The shop can stay open: sales during the count are kept. The owner approves the differences at the end.</p>
          <form onSubmit={start} className="stocktake-start">
            <label>Name<input required minLength={2} placeholder="e.g. End of November" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>What to count
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Everything</option>
                {categories.map((c) => <option key={c} value={c}>Only {c}</option>)}
              </select>
            </label>
            <button type="submit" className="stocktake-btn-primary">Start counting</button>
          </form>
        </section>
        {past.length > 0 && (
          <section className="stocktake-card">
            <span className="stocktake-eyebrow">Archive</span>
            <h3 className="stocktake-heading">Past stock takes</h3>
            <ul className="stocktake-past">
              {past.map((p) => (
                <li key={p._id}>
                  <button type="button" className="stocktake-past-item" onClick={async () => setReport(await api(`/api/admin/stocktakes/${p._id}`))}>
                    <span className="stocktake-past-name">{p.name}{p.category ? ` (${p.category})` : ""}</span>
                    <span className="stocktake-muted">{p.status === "completed" ? `${when(p.completedAt)} · ${p.totals?.missingUnits || 0} missing, ${p.totals?.extraUnits || 0} extra` : p.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const t = take.totals;
  return (
    <div className="stocktake">
      {/* ── SCANNING & LOOKUP CARD ── */}
      <section className="stocktake-card">
        <div className="stocktake-head-row">
          <div>
            <span className="stocktake-eyebrow">Active Count</span>
            <h3 className="stocktake-heading">Counting: {take.name}{take.category ? ` (${take.category} only)` : ""}</h3>
          </div>
          <button type="button" className="stocktake-btn-ghost stocktake-refresh-btn" onClick={refresh}>Refresh</button>
        </div>
        <p className="stocktake-muted">Started by {take.startedByName} · {t.counted} product(s) counted · {t.uncounted} not counted yet</p>

        {/* Dominant scan button for walking the shelves on a phone */}
        <button type="button" className="stocktake-btn-primary stocktake-scan-hero" onClick={() => setScanning(true)}>
          📷 Scan items
        </button>

        {lastScan && (
          <p key={scanTick} className="stocktake-last" role="status">
            <span className="stocktake-last-eyebrow">Last scan</span>
            <span className="stocktake-last-text">{lastScan}</span>
          </p>
        )}

        <div className="stocktake-inputs-grid">
          <input
            aria-label="Scan or type a code"
            placeholder="Scan or type a barcode, then Enter"
            value={code}
            enterKeyHint="go"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scan(code); setCode(""); } }}
          />
          <input
            className="stocktake-search"
            aria-label="Find a product without a barcode"
            placeholder="No barcode? Find the product by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {matches.length > 0 && (
          <ul className="stocktake-matches">
            {matches.map((p) => (
              <li key={p._id}>
                <button type="button" onClick={() => { changeLine(p._id, { by: 1 }); setSearch(""); }}>
                  <span className="stocktake-match-name">{p.name}</span>
                  <span className="stocktake-match-add">
                    +1{counted.get(String(p._id)) ? ` (now ${counted.get(String(p._id)).counted})` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {scanning && <BarcodeScanner continuous message={lastScan} onCode={scan} onClose={() => setScanning(false)} />}
      </section>

      {/* ── COUNTED LIST (Card-rows with 44px+ tap controls) ── */}
      <section className="stocktake-card">
        <span className="stocktake-eyebrow">Shelf Progress</span>
        <h3 className="stocktake-heading">Counted so far</h3>
        {take.lines.length === 0 ? (
          <p className="stocktake-muted">Nothing counted yet.</p>
        ) : (
          <ul className="stocktake-lines">
            {take.lines.map((l) => (
              <li className="stocktake-line-row" key={String(l.product)}>
                <div className="stocktake-line-main">
                  <span className="stocktake-line-name">{l.name}</span>
                  <div className="stocktake-line-meta">
                    <span className="stocktake-muted">System said {l.systemAtCount}</span>
                    <DiffPill difference={l.difference} />
                  </div>
                </div>

                <div className="stocktake-line-controls">
                  <span className="stocktake-qty">
                    <button type="button" aria-label={`One less ${l.name}`} onClick={() => changeLine(l.product, { by: -1 })}>−</button>
                    <input
                      type="number" min="0" inputMode="numeric" aria-label={`Counted ${l.name}`} defaultValue={l.counted} key={`${l.product}-${l.counted}`}
                      onBlur={(e) => { const n = parseInt(e.target.value, 10); if (Number.isInteger(n) && n >= 0 && n !== l.counted) changeLine(l.product, { counted: n }); }}
                    />
                    <button type="button" aria-label={`One more ${l.name}`} onClick={() => changeLine(l.product, { by: 1 })}>+</button>
                  </span>
                  <button type="button" className="stocktake-remove-btn" onClick={() => removeLine(l.product)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {take.uncounted.length > 0 && (
          <details className="stocktake-uncounted">
            <summary>{take.uncounted.length} product(s) not counted yet ({t.uncountedUnits} units on the system)</summary>
            <ul>{take.uncounted.map((u) => <li key={String(u.product)}>{u.name}: {u.stock} on the system</li>)}</ul>
          </details>
        )}
      </section>

      {/* ── OWNER RESULT & APPROVAL CARD ── */}
      <section className="stocktake-card">
        <span className="stocktake-eyebrow">Review &amp; Apply</span>
        <h3 className="stocktake-heading">Result</h3>

        <div className="stocktake-result-stats">
          <div className="stocktake-stat is-minus">
            <span className="stocktake-stat-label">Missing units</span>
            <strong className="stocktake-stat-val">{t.missingUnits}</strong>
          </div>
          <div className="stocktake-stat is-plus">
            <span className="stocktake-stat-label">Extra units</span>
            <strong className="stocktake-stat-val">{t.extraUnits}</strong>
          </div>
        </div>

        {canApprove ? (
          <>
            <label className="stocktake-check">
              <input type="checkbox" checked={zeroUncounted} onChange={(e) => setZeroUncounted(e.target.checked)} />
              <span>Full count: set products nobody counted to 0</span>
            </label>
            <div className="stocktake-actions">
              <button type="button" className="stocktake-btn-primary" onClick={approve} disabled={t.counted === 0 && !zeroUncounted}>
                Approve and apply
              </button>
              <button type="button" className="stocktake-btn-ghost" onClick={cancel}>
                Cancel count
              </button>
            </div>
          </>
        ) : (
          <p className="stocktake-muted">When counting is finished, the owner reviews and approves it.</p>
        )}
      </section>
    </div>
  );
}
