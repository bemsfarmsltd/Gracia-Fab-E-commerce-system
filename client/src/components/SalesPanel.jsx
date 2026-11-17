import { useState, useEffect, useCallback } from "react";
import API_URL from "../config";
import { downloadOrdersCsv } from "../utils/adminDownload";
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

// Admin dashboard → Sales tab: paid sales by month, best sellers, and an
// order spreadsheet export. Refunded (cancelled) orders aren't counted.
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

  const handleExport = async (range) => {
    setExporting(true);
    setExportNote("");
    setError("");
    try {
      const name = await downloadOrdersCsv(range);
      setExportNote(`Downloaded ${name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const best = Math.max(1, ...(report?.months || []).map((m) => m.revenue));

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
                <h2 className="stat-value">{naira(report.totals.revenue)}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div>
                <p className="stat-label">Paid orders</p>
                <h2 className="stat-value">{report.totals.orders}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧴</div>
              <div>
                <p className="stat-label">Items sold</p>
                <h2 className="stat-value">{report.totals.itemsSold}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧾</div>
              <div>
                <p className="stat-label">Average order</p>
                <h2 className="stat-value">{naira(report.totals.averageOrder)}</h2>
              </div>
            </div>
          </div>

          <div className="admin-section">
            <h2>By month</h2>
            <p className="sales-note">
              Paid orders only, by the day they were paid (Nigerian time). Revenue is what customers paid,
              including delivery and after vouchers. Cancelled and refunded orders aren't counted.
            </p>
            <table className="admin-table sales-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                  <th>Items</th>
                  <th>Average order</th>
                  <th>Vouchers</th>
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
                    <td>{m.orders}</td>
                    <td>{m.itemsSold}</td>
                    <td>{m.orders ? naira(m.averageOrder) : "—"}</td>
                    <td>{m.discounts ? `−${naira(m.discounts)}` : "—"}</td>
                    <td>{naira(m.delivery)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-section">
            <h2>Best sellers ({months} months)</h2>
            {report.topProducts.length === 0 ? (
              <p className="sales-note">No paid sales in this period yet.</p>
            ) : (
              <table className="admin-table sales-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Units sold</th>
                    <th>Orders</th>
                    <th>Sales before vouchers</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p, i) => (
                    <tr key={p.productId}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.units}</td>
                      <td>{p.orders}</td>
                      <td>{naira(p.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="admin-section sales-export">
        <h2>Export orders</h2>
        <p className="sales-note">
          A spreadsheet (CSV, opens in Excel or Google Sheets) of orders placed between these dates, paid or not,
          with customer, delivery, items, vouchers, payment and status.
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
        </div>
        {exportNote && <p className="sales-note" role="status">✅ {exportNote}</p>}
      </div>
    </div>
  );
}

export default SalesPanel;
