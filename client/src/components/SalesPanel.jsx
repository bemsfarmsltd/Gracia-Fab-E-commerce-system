import { useState, useEffect, useCallback } from "react";
import API_URL from "../config";
import { downloadOrdersCsv, downloadShopSalesCsv } from "../utils/adminDownload";
import "./SalesPanel.css";

const PERIODS = [3, 6, 12];

const naira = (n) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n || 0);

// "2026-11" → "Nov 2026"
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-NG", { month: "short", year: "numeric", timeZone: "UTC" });
};

// Today in Nigeria (WAT, UTC+1) as YYYY-MM-DD, and the 1st of this month.
const watToday = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

// Admin dashboard → Sales tab: paid online orders plus completed shop-till
// sales by month, best sellers across both, how the till was paid, and
// spreadsheet exports. Refunded orders and voided till sales aren't counted.
function SalesPanel() {
  const [months, setMonths] = useState(6);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => `${watToday().slice(0, 8)}01`);
  const [to, setTo] = useState(watToday);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/reports/sales?months=${months}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't load the sales report");
      setReport(data);
    } catch (err) {
      setError(err.message);
    }
  }, [months]);

  useEffect(() => {
    // Fetch-orchestration effect: load only sets state after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleExport = async (range, download = downloadOrdersCsv) => {
    setExporting(true);
    setExportNote("");
    setError("");
    try {
      const name = await download(range);
      setExportNote(`Downloaded ${name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const best = Math.max(1, ...(report?.months || []).map((m) => m.revenue));
  // Older API responses had no shop fields.
  const totals = { onlineRevenue: 0, shopRevenue: 0, shopSales: 0, shopByMethod: [], ...report?.totals };

  return (
    <div className="admin-content sales">
      <div className="admin-section-header sales-header">
        <h2>Sales</h2>
        <div className="inventory-filters" role="group" aria-label="Report period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`inventory-filter ${months === p ? "active" : ""}`}
              aria-pressed={months === p}
              onClick={() => setMonths(p)}
            >
              {p} months
            </button>
          ))}
        </div>
      </div>

      {error && <div className="admin-error" role="alert">⚠️ {error}</div>}

      {!report && !error && <p className="admin-loading">Loading sales...</p>}

      {report && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div>
                <p className="stat-label">Revenue ({months} months)</p>
                <h2 className="stat-value">{naira(totals.revenue)}</h2>
                <p className="sales-stat-note" data-testid="sales-split">
                  Online {naira(totals.onlineRevenue)} · Shop till {naira(totals.shopRevenue)}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div>
                <p className="stat-label">Paid online orders</p>
                <h2 className="stat-value">{totals.orders}</h2>
                <p className="sales-stat-note">
                  {totals.orders ? `Average ${naira(totals.averageOrder)}` : "No paid orders yet"}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🛍️</div>
              <div>
                <p className="stat-label">Shop sales</p>
                <h2 className="stat-value">{totals.shopSales}</h2>
                <p className="sales-stat-note">Receipts from the till</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧴</div>
              <div>
                <p className="stat-label">Items sold</p>
                <h2 className="stat-value">{totals.itemsSold}</h2>
                <p className="sales-stat-note">Online and in the shop</p>
              </div>
            </div>
          </div>

          <div className="admin-section">
            <h2>By month</h2>
            <p className="sales-note">
              Online orders count on the day they were paid, shop sales on the day they were rung up at the till
              (Nigerian time). Online revenue is what customers paid, including delivery and after vouchers.
              Cancelled or refunded orders and voided till sales aren't counted.
            </p>
            <table className="admin-table sales-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Revenue</th>
                  <th>Online</th>
                  <th>Shop till</th>
                  <th>Online orders</th>
                  <th>Shop sales</th>
                  <th>Items</th>
                  <th>Average online order</th>
                  <th>Discounts</th>
                  <th>Delivery fees</th>
                </tr>
              </thead>
              <tbody>
                {[...report.months].reverse().map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td>
                      <div className="sales-bar-cell">
                        <span>{naira(m.revenue)}</span>
                        <span className="sales-bar" aria-hidden="true">
                          <span style={{ width: `${(m.revenue / best) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td>{naira(m.onlineRevenue)}</td>
                    <td>{naira(m.shopRevenue)}</td>
                    <td>{m.orders}</td>
                    <td>{m.shopSales || 0}</td>
                    <td>{m.itemsSold}</td>
                    <td>{m.orders ? naira(m.averageOrder) : "—"}</td>
                    <td>{m.discounts ? `−${naira(m.discounts)}` : "—"}</td>
                    <td>{naira(m.delivery)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sales-note sales-note-after">
              Discounts are online vouchers plus discounts given at the till.
            </p>
          </div>

          <div className="admin-section">
            <h2>Best sellers ({months} months)</h2>
            {report.topProducts.length === 0 ? (
              <p className="sales-note">No sales in this period yet.</p>
            ) : (
              <table className="admin-table sales-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Units sold</th>
                    <th>Online</th>
                    <th>Shop</th>
                    <th>Sales before discounts</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p, i) => (
                    <tr key={p.productId}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.units}</td>
                      <td>{p.onlineUnits ?? p.units}</td>
                      <td>{p.shopUnits ?? 0}</td>
                      <td>{naira(p.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="admin-section">
            <h2>How the till was paid ({months} months)</h2>
            {totals.shopSales === 0 ? (
              <p className="sales-note">No shop sales in this period yet.</p>
            ) : (
              <table className="admin-table sales-table sales-methods">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Sales</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.shopByMethod.map((m) => (
                    <tr key={m.method}>
                      <td>{m.label}</td>
                      <td>{m.sales}</td>
                      <td>{naira(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="admin-section sales-export">
        <h2>Download spreadsheets</h2>
        <p className="sales-note">
          Spreadsheets (CSV, open in Excel or Google Sheets) for the dates below. Orders: online orders placed,
          paid or not, with customer, delivery, items, vouchers, payment and status. Shop sales: every till
          receipt, with who sold it, items, discount, how it was paid, and voided receipts marked.
        </p>
        <div className="sales-export-row">
          <label>
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-admin-save"
            disabled={exporting}
            onClick={() => handleExport({ from, to })}
          >
            {exporting ? "Preparing..." : "⬇ Download orders"}
          </button>
          <button
            type="button"
            className="btn-admin-cancel"
            disabled={exporting}
            onClick={() => handleExport({})}
          >
            All orders
          </button>
          <button
            type="button"
            className="btn-admin-save"
            disabled={exporting}
            onClick={() => handleExport({ from, to }, downloadShopSalesCsv)}
          >
            ⬇ Download shop sales
          </button>
        </div>
        {exportNote && <p className="sales-note" role="status">✅ {exportNote}</p>}
      </div>
    </div>
  );
}

export default SalesPanel;
