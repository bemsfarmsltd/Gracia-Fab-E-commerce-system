import { useState, useEffect, useCallback } from "react";
import AdminCustomerDetail from "./AdminCustomerDetail";
import API_URL from "../../config";

export default function AdminCustomers({
  getHeaders,
  formatPrice,
  setAdminError,
  setAdminNotice,
}) {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API_URL}/api/admin/customers?${params.toString()}`, {
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to load customers directory");
      }

      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, getHeaders, setAdminError]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // If a customer is selected for detail inspection, render detail view
  if (selectedCustomerId) {
    return (
      <AdminCustomerDetail
        customerId={selectedCustomerId}
        onBack={() => {
          setSelectedCustomerId(null);
          fetchCustomers();
        }}
        getHeaders={getHeaders}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );
  }

  return (
    <div className="admin-content admin-customers-view">
      {/* ── TOOLBAR ── */}
      <div className="customers-toolbar-card">
        <div className="customers-toolbar-left">
          <div className="customers-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search customers by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="customers-search-input"
              aria-label="Search customers"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear customer search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="customers-toolbar-right">
          <div className="customers-sort-wrap">
            <label htmlFor="customers-sort-select" className="sort-label">Sort By:</label>
            <select
              id="customers-sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="customers-sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="spent">Highest Total Spend</option>
              <option value="last-order">Recent Order Date</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── CUSTOMERS DIRECTORY TABLE ── */}
      {loading ? (
        <p className="admin-loading">Loading customers directory...</p>
      ) : customers.length === 0 ? (
        <div className="admin-empty-state">
          <p className="empty-title">No customers found</p>
          <p className="empty-sub">
            {search
              ? `No registered customers matching "${search}".`
              : "No customer accounts have been registered yet."}
          </p>
          {search && (
            <button
              type="button"
              className="btn-admin-cancel"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table modern-customers-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Loyalty Tier</th>
                <th>Last Order</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const initials = c.name ? c.name.charAt(0).toUpperCase() : "C";
                return (
                  <tr key={c._id}>
                    <td>
                      <div className="customer-cell-wrap">
                        <div className="customer-cell-avatar" aria-hidden="true">
                          {initials}
                        </div>
                        <div className="customer-cell-meta">
                          <button
                            type="button"
                            className="customer-name-link"
                            onClick={() => setSelectedCustomerId(c._id)}
                            title={`Inspect ${c.name}'s profile`}
                          >
                            {c.name || "Customer"}
                          </button>
                          <span className="customer-email-sub">{c.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="cell-phone">
                      {c.phone || <span className="cell-muted">—</span>}
                    </td>

                    <td className="cell-date">
                      {new Date(c.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td>
                      <span className="customer-orders-pill">
                        {c.ordersCount || 0} order{c.ordersCount !== 1 ? "s" : ""}
                        {c.paidOrders > 0 && ` (${c.paidOrders} paid)`}
                      </span>
                    </td>

                    <td className="cell-price font-bold">
                      {formatPrice ? formatPrice(c.totalSpent || 0) : `₦${Number(c.totalSpent || 0).toLocaleString()}`}
                    </td>

                    <td>
                      <span className={`loyalty-tier-badge tier-${c.loyaltyTier || "bronze"}`}>
                        ✦ {c.loyaltyTier ? c.loyaltyTier.toUpperCase() : "BRONZE"}
                        <span className="tier-points-tag">({c.loyaltyPoints || 0} pts)</span>
                      </span>
                    </td>

                    <td className="cell-last-order">
                      {c.lastOrderAt ? (
                        new Date(c.lastOrderAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      ) : (
                        <span className="cell-muted">No orders yet</span>
                      )}
                    </td>

                    <td className="td-actions">
                      <button
                        type="button"
                        className="btn-inspect-customer"
                        onClick={() => setSelectedCustomerId(c._id)}
                        aria-label={`View profile for ${c.name}`}
                      >
                        Profile &amp; Notes →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAGINATION ── */}
      {total > 0 && (
        <div className="orders-pagination">
          <div className="pagination-count">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} customer(s)
          </div>

          {pages > 1 && (
            <div className="pagination-buttons">
              <button
                type="button"
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                « Prev
              </button>

              {Array.from({ length: pages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`page-btn ${page === num ? "active" : ""}`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                className="page-btn"
                disabled={page === pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next »
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
