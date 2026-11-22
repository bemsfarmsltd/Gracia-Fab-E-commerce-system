import { useState, useEffect, useCallback } from "react";
import AdminMiniChart from "./AdminMiniChart";
import API_URL from "../../config";

const statusColors = {
  pending: "#f39c12",
  paid: "#2ecc71",
  processing: "#3498db",
  shipped: "#9b59b6",
  delivered: "#27ae60",
  cancelled: "#e74c3c",
};

export default function AdminOverview({
  onFilterOrders,
  setActiveTab,
  getHeaders,
  formatPrice,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/admin/overview`, {
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to load overview data");
      }
      setData(json);
    } catch (err) {
      console.error("AdminOverview fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading && !data) {
    return (
      <div className="admin-content">
        <p className="admin-loading">Loading store overview...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-content">
        <div className="admin-error" role="alert">
          ⚠️ {error}
          <button
            type="button"
            className="btn-admin-cancel"
            style={{ marginLeft: "1rem" }}
            onClick={fetchOverview}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totals = data?.totals || { revenue: 0, paidOrders: 0, averageOrderValue: 0, customers: 0, products: 0 };
  const last7 = data?.last7 || { revenue: 0, paidOrders: 0, newCustomers: 0 };
  const prev7 = data?.prev7 || { revenue: 0, paidOrders: 0, newCustomers: 0 };
  const last30 = data?.last30 || { revenue: 0, paidOrders: 0, newCustomers: 0 };
  const daily = data?.daily || [];
  const statusCounts = data?.statusCounts || {};
  const recentOrders = data?.recentOrders || [];
  const lowStock = data?.lowStock || [];
  const outOfStockCount = data?.outOfStockCount || 0;
  const lowStockThreshold = data?.lowStockThreshold || 5;

  // Comparison helpers (never invent numbers when earlier period was 0)
  const calcRevComparison = () => {
    if (prev7.revenue <= 0) {
      return "No orders last week";
    }
    const diff = last7.revenue - prev7.revenue;
    const pct = ((diff / prev7.revenue) * 100).toFixed(1);
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${pct}% vs previous 7 days`;
  };

  const calcOrdersComparison = () => {
    if (prev7.paidOrders <= 0) {
      return "No orders last week";
    }
    const diff = last7.paidOrders - prev7.paidOrders;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff} vs previous 7 days`;
  };

  const calcCustomersComparison = () => {
    if (prev7.newCustomers <= 0) {
      return "No new customers last week";
    }
    const diff = last7.newCustomers - prev7.newCustomers;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff} vs previous 7 days`;
  };

  const handleStatusChipClick = (status) => {
    if (onFilterOrders) {
      onFilterOrders(status);
    } else if (setActiveTab) {
      setActiveTab("orders");
    }
  };

  return (
    <div className="admin-content admin-overview-wrap">
      {/* ── TOP SECTION: BIG WINE CARD + 3 METRIC CARDS ── */}
      <div className="overview-top-grid">
        {/* DashLite-Inspired Big Wine Card */}
        <div className="admin-wine-card">
          <div className="wine-card-glow" aria-hidden="true" />
          <div className="wine-card-content">
            <div className="wine-card-header">
              <div>
                <span className="wine-card-eyebrow">✦ 30-DAY STORE PERFORMANCE</span>
                <h2 className="wine-card-title">Net Store Revenue</h2>
              </div>
              <span className="wine-card-badge">Lagos Timezone (UTC+1)</span>
            </div>

            <div className="wine-card-figures">
              <div className="wine-card-primary">
                <span className="wine-card-amount">
                  {formatPrice(last30.revenue || totals.revenue || 0)}
                </span>
                <span className="wine-card-sub">
                  Total revenue collected from {last30.paidOrders || totals.paidOrders || 0} paid order(s)
                </span>
              </div>

              <div className="wine-card-comparison">
                <div className="comparison-metric">
                  <span className="comp-label">Last 7 Days</span>
                  <span className="comp-val">{formatPrice(last7.revenue)}</span>
                </div>
                <div className="comparison-pill">
                  {calcRevComparison()}
                </div>
              </div>
            </div>

            {/* SVG Sparkline of 30-day Daily Revenue */}
            <div className="wine-card-chart">
              <div className="wine-chart-header">
                <span>Daily Revenue (30-day trend)</span>
              </div>
              <AdminMiniChart
                data={daily.map((d) => d.revenue)}
                strokeColor="#D4AF37"
                fillColor="rgba(212, 175, 55, 0.15)"
                height={52}
                ariaLabel="30-day revenue trend"
              />
            </div>
          </div>
        </div>

        {/* 3 Metric Cards Grid */}
        <div className="overview-subcards">
          {/* Card 1: Average Order Value */}
          <div className="stat-card modern-stat-card">
            <div className="stat-card-top">
              <div>
                <p className="stat-label">AVERAGE ORDER VALUE</p>
                <h3 className="stat-value">{formatPrice(totals.averageOrderValue || 0)}</h3>
              </div>
              <div className="stat-icon-wrap" aria-hidden="true">💎</div>
            </div>
            <div className="stat-card-bottom">
              <span className="stat-note">Based on {totals.paidOrders || 0} completed order(s)</span>
            </div>
          </div>

          {/* Card 2: Paid Orders (7 Days) */}
          <div className="stat-card modern-stat-card">
            <div className="stat-card-top">
              <div>
                <p className="stat-label">PAID ORDERS (7 DAYS)</p>
                <h3 className="stat-value">{last7.paidOrders}</h3>
              </div>
              <div className="stat-icon-wrap" aria-hidden="true">📦</div>
            </div>
            <div className="stat-card-bottom">
              <span className="stat-badge">{calcOrdersComparison()}</span>
              <AdminMiniChart
                data={daily.slice(-7).map((d) => d.paidOrders)}
                strokeColor="#7A2432"
                height={26}
                ariaLabel="7-day orders trend"
              />
            </div>
          </div>

          {/* Card 3: New Customers (7 Days) */}
          <div className="stat-card modern-stat-card">
            <div className="stat-card-top">
              <div>
                <p className="stat-label">NEW CUSTOMERS (7 DAYS)</p>
                <h3 className="stat-value">{last7.newCustomers}</h3>
              </div>
              <div className="stat-icon-wrap" aria-hidden="true">👥</div>
            </div>
            <div className="stat-card-bottom">
              <span className="stat-badge">{calcCustomersComparison()}</span>
              <AdminMiniChart
                data={daily.slice(-7).map((d) => d.newCustomers)}
                strokeColor="#7A2432"
                height={26}
                ariaLabel="7-day customer signup trend"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: ORDERS BY STATUS PIPELINE CHIPS ── */}
      <div className="admin-section status-pipeline-section">
        <div className="pipeline-header">
          <div>
            <h3 className="pipeline-title">Order Fulfillment Pipeline</h3>
            <p className="pipeline-subtitle">Quickly filter active orders by workflow stage</p>
          </div>
          <button
            type="button"
            className="btn-view-all-orders"
            onClick={() => setActiveTab("orders")}
          >
            Open All Orders ({Object.values(statusCounts).reduce((a, b) => a + b, 0)}) →
          </button>
        </div>

        <div className="status-pipeline-chips">
          {[
            { id: "pending", label: "Pending Payment", count: statusCounts.pending || 0, color: statusColors.pending },
            { id: "processing", label: "Processing & Packing", count: statusCounts.processing || 0, color: statusColors.processing },
            { id: "shipped", label: "Shipped & In Transit", count: statusCounts.shipped || 0, color: statusColors.shipped },
            { id: "delivered", label: "Delivered", count: statusCounts.delivered || 0, color: statusColors.delivered },
            { id: "cancelled", label: "Cancelled / Refunded", count: statusCounts.cancelled || 0, color: statusColors.cancelled },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="status-chip-btn"
              onClick={() => handleStatusChipClick(chip.id)}
              title={`View ${chip.label} orders`}
            >
              <span className="chip-indicator" style={{ background: chip.color }} aria-hidden="true" />
              <span className="chip-label">{chip.label}</span>
              <span className="chip-count">{chip.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TWO-COLUMN SECTION: RECENT ORDERS & STOCK ALERTS ── */}
      <div className="overview-split-grid">
        {/* Recent Orders Table */}
        <div className="admin-section overview-table-card">
          <div className="admin-section-header">
            <div>
              <h2>Recent Orders</h2>
              <span className="header-sub">Latest customer transactions</span>
            </div>
            <button
              type="button"
              className="btn-admin-cancel"
              onClick={() => setActiveTab("orders")}
            >
              Manage Orders →
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="admin-empty-state">
              <p>No orders yet recorded.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order._id}
                      onClick={() => handleStatusChipClick(order.status)}
                      style={{ cursor: "pointer" }}
                      title="Click to view in Orders"
                    >
                      <td className="cell-code">#{order._id.slice(-8).toUpperCase()}</td>
                      <td>
                        <div className="cell-user-wrap">
                          <span className="cell-user-name">{order.user?.name || "Guest Customer"}</span>
                          <span className="cell-sub">{order.user?.email || "No email"}</span>
                        </div>
                      </td>
                      <td className="cell-price">{formatPrice(order.totalPrice)}</td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: statusColors[order.status] || "#7A2432",
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="cell-date">
                        {new Date(order.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock Alerts & Inventory Health */}
        <div className="admin-section overview-stock-card">
          <div className="admin-section-header">
            <div>
              <h2>Inventory Health</h2>
              <span className="header-sub">Items requiring restock attention</span>
            </div>
            <button
              type="button"
              className="btn-admin-cancel"
              onClick={() => setActiveTab("inventory")}
            >
              Open Inventory →
            </button>
          </div>

          <div className="stock-alert-content">
            {outOfStockCount > 0 && (
              <div className="stock-badge-alert out-of-stock">
                <span className="alert-icon">🚫</span>
                <div>
                  <strong>{outOfStockCount} Product(s) Out of Stock</strong>
                  <p>Customers currently cannot purchase these items.</p>
                </div>
              </div>
            )}

            {lowStock.length > 0 ? (
              <div className="stock-badge-alert running-low">
                <span className="alert-icon">⚠️</span>
                <div>
                  <strong>{lowStock.length} Running Low (≤ {lowStockThreshold} units left)</strong>
                  <ul className="low-stock-list">
                    {lowStock.slice(0, 6).map((p) => (
                      <li key={p.name}>
                        <span className="low-stock-name">{p.name}</span>
                        <span className="low-stock-qty">{p.stock} left</span>
                      </li>
                    ))}
                    {lowStock.length > 6 && (
                      <li className="low-stock-more">+ {lowStock.length - 6} more in inventory</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              outOfStockCount === 0 && (
                <div className="stock-healthy-banner">
                  <span className="healthy-icon">✓</span>
                  <div>
                    <strong>All catalogue inventory healthy</strong>
                    <p>No products are currently out of stock or running low.</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
