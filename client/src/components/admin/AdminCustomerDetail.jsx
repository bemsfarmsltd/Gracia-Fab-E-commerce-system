import { useState, useEffect, useCallback } from "react";
import API_URL from "../../config";
import { can } from "../../utils/portal";

export default function AdminCustomerDetail({
  user,
  customerId,
  onBack,
  getHeaders,
  formatPrice,
  setAdminError,
  setAdminNotice,
}) {
  const canDeleteNotes = user === undefined ? true : can(user, "customers.export");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/customers/${customerId}`, {
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Failed to load customer details");
      }

      setData(json);
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setLoading(false);
    }
  }, [customerId, getHeaders, setAdminError]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || submittingNote) return;

    try {
      setSubmittingNote(true);
      const res = await fetch(`${API_URL}/api/admin/customers/${customerId}/notes`, {
        method: "POST",
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ text: newNote.trim() }),
      });

      const note = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(note.message || "Failed to add staff note");
      }

      setData((prev) => (prev ? { ...prev, notes: [note, ...(prev.notes || [])] } : prev));
      setNewNote("");
      if (setAdminNotice) setAdminNotice("Staff note added");
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Delete this staff note?")) return;

    try {
      setDeletingNoteId(noteId);
      const res = await fetch(`${API_URL}/api/admin/customers/${customerId}/notes/${noteId}`, {
        method: "DELETE",
        headers: getHeaders ? getHeaders() : {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resJson.message || "Failed to delete note");
      }

      setData((prev) => (prev ? {
        ...prev,
        notes: (prev.notes || []).filter((n) => n._id !== noteId),
      } : prev));
      if (setAdminNotice) setAdminNotice("Staff note deleted");
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-content">
        <p className="admin-loading">Loading customer profile &amp; history...</p>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="admin-content admin-empty-state">
        <p className="empty-title">Customer not found</p>
        <p className="empty-sub">This account could not be found or has been removed.</p>
        <button type="button" className="btn-admin-cancel" onClick={onBack}>
          ← Back to Customers Directory
        </button>
      </div>
    );
  }

  const { customer, stats, orders = [], notes = [], pointsHistory = [], bookings = [] } = data;
  const initials = customer.name ? customer.name.charAt(0).toUpperCase() : "C";

  return (
    <div className="admin-content admin-customer-detail-view">
      {/* ── TOP BACK NAVIGATION ── */}
      <div className="customer-detail-nav">
        <button
          type="button"
          className="btn-back-link"
          onClick={onBack}
          aria-label="Back to customers list"
        >
          ← Back to Customers Directory
        </button>
      </div>

      {/* ── PROFILE HEADER BANNER ── */}
      <div className="customer-header-card">
        <div className="customer-header-profile">
          <div className="customer-header-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="customer-header-details">
            <div className="customer-name-row">
              <h2 className="customer-header-name">{customer.name || "Customer"}</h2>
              <span className={`loyalty-tier-badge tier-${customer.loyaltyTier || "bronze"}`}>
                ✦ {customer.loyaltyTier ? customer.loyaltyTier.toUpperCase() : "BRONZE"}
                <span className="tier-points-tag">({customer.loyaltyPoints || 0} pts)</span>
              </span>
            </div>
            <div className="customer-contact-sub">
              <span className="contact-item">📧 {customer.email}</span>
              {customer.phone && (
                <span className="contact-item">📞 {customer.phone}</span>
              )}
              <span className="contact-item">
                📅 Member since {new Date(customer.createdAt).toLocaleDateString("en-NG", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK STATS GRID ── */}
      <div className="customer-stats-grid">
        <div className="customer-stat-card">
          <span className="stat-label">Total Spend</span>
          <span className="stat-val highlight-wine">
            {formatPrice ? formatPrice(stats.totalSpent || 0) : `₦${Number(stats.totalSpent || 0).toLocaleString()}`}
          </span>
          <span className="stat-hint">Excludes cancelled orders</span>
        </div>

        <div className="customer-stat-card">
          <span className="stat-label">Orders Placed</span>
          <span className="stat-val">
            {stats.ordersCount || 0}
            <span className="stat-subval"> ({stats.paidOrders || 0} paid)</span>
          </span>
          <span className="stat-hint">Lifetime purchases</span>
        </div>

        <div className="customer-stat-card">
          <span className="stat-label">Average Order Value</span>
          <span className="stat-val">
            {formatPrice ? formatPrice(stats.averageOrderValue || 0) : `₦${Number(stats.averageOrderValue || 0).toLocaleString()}`}
          </span>
          <span className="stat-hint">Based on paid orders</span>
        </div>

        <div className="customer-stat-card">
          <span className="stat-label">Last Order Placed</span>
          <span className="stat-val text-sm">
            {stats.lastOrderAt ? (
              new Date(stats.lastOrderAt).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            ) : (
              "No orders yet"
            )}
          </span>
          <span className="stat-hint">
            {stats.firstOrderAt ? `First order: ${new Date(stats.firstOrderAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}` : "No activity"}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT TWO COLUMNS ── */}
      <div className="customer-detail-columns">
        {/* LEFT COLUMN: Address, Orders, Bookings */}
        <div className="customer-detail-main">
          {/* Latest Shipping Address */}
          <div className="customer-panel-card">
            <h3 className="panel-card-title">📍 Latest Delivery Address</h3>
            {customer.latestAddress ? (
              <div className="customer-address-box">
                <p className="address-line font-semibold">
                  {customer.latestAddress.address}
                </p>
                <p className="address-line">
                  {[customer.latestAddress.city, customer.latestAddress.state, customer.latestAddress.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {customer.latestAddress.phone && (
                  <p className="address-line text-muted">
                    Contact Phone: {customer.latestAddress.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="empty-subtext">No delivery address on record yet.</p>
            )}
          </div>

          {/* Orders History */}
          <div className="customer-panel-card">
            <div className="panel-card-header">
              <h3 className="panel-card-title">📦 Order History ({orders.length})</h3>
            </div>
            {orders.length === 0 ? (
              <p className="empty-subtext">No orders placed by this customer yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table customer-orders-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o._id}>
                        <td className="font-mono text-sm">
                          #{String(o._id).slice(-6).toUpperCase()}
                        </td>
                        <td className="cell-date">
                          {new Date(o.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td>
                          {o.itemsCount || (o.orderItems || []).length} item{o.itemsCount !== 1 ? "s" : ""}
                        </td>
                        <td className="cell-price font-bold">
                          {formatPrice ? formatPrice(o.totalPrice) : `₦${Number(o.totalPrice).toLocaleString()}`}
                        </td>
                        <td>
                          <span className={`payment-pill ${o.isPaid ? "paid" : "unpaid"}`}>
                            {o.isPaid ? "✓ Paid" : "Pending"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${o.status}`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Salon & Bridal Bookings */}
          {bookings && bookings.length > 0 && (
            <div className="customer-panel-card">
              <h3 className="panel-card-title">📅 In-Store Appointments ({bookings.length})</h3>
              <div className="admin-table-wrap">
                <table className="admin-table customer-bookings-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Date &amp; Time (Lagos)</th>
                      <th>Staff</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b._id}>
                        <td className="font-semibold">{b.serviceLabel || b.service}</td>
                        <td>
                          {new Date(b.startsAt).toLocaleDateString("en-NG", {
                            timeZone: "Africa/Lagos",
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          at{" "}
                          {new Date(b.startsAt).toLocaleTimeString("en-NG", {
                            timeZone: "Africa/Lagos",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>{b.staff || <span className="cell-muted">—</span>}</td>
                        <td>
                          <span className={`status-pill status-${b.status}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Staff Notes & Loyalty Points */}
        <div className="customer-detail-side">
          {/* Staff Notes Box */}
          <div className="customer-panel-card notes-panel-card">
            <div className="notes-card-header">
              <h3 className="panel-card-title">📝 Staff Notes</h3>
              <span className="staff-only-notice">
                🔒 Staff only (never visible to customer)
              </span>
            </div>

            {/* Note submission form */}
            <form onSubmit={handleAddNote} className="add-note-form">
              <label htmlFor="staff-note-text" className="sr-only">Add staff note</label>
              <textarea
                id="staff-note-text"
                rows={3}
                placeholder="Log internal notes (e.g. skin sensitivity, custom wig preferences, follow-up reminders)..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="add-note-textarea"
                aria-label="Add staff note"
              />
              <div className="note-form-actions">
                <button
                  type="submit"
                  disabled={!newNote.trim() || submittingNote}
                  className="btn-add-note"
                >
                  {submittingNote ? "Saving..." : "+ Save Staff Note"}
                </button>
              </div>
            </form>

            {/* Notes List */}
            <div className="notes-thread-list">
              {notes.length === 0 ? (
                <p className="empty-subtext">No staff notes recorded yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n._id} className="note-card-item">
                    <div className="note-header-line">
                      <span className="note-author font-semibold">{n.author || "Staff"}</span>
                      <div className="note-meta-right">
                        <span className="note-date">
                          {new Date(n.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {canDeleteNotes && (
                          <button
                            type="button"
                            className="btn-delete-note"
                            onClick={() => handleDeleteNote(n._id)}
                            disabled={deletingNoteId === n._id}
                            title="Delete staff note"
                            aria-label="Delete staff note"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="note-text-body">{n.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Loyalty Points History */}
          {pointsHistory && pointsHistory.length > 0 && (
            <div className="customer-panel-card points-history-card">
              <h3 className="panel-card-title">✦ Points History (Recent)</h3>
              <ul className="points-history-list">
                {pointsHistory.map((pt, i) => (
                  <li key={i} className="points-history-item">
                    <div className="points-reason-wrap">
                      <span className="points-reason">{pt.reason || "Reward activity"}</span>
                      <span className="points-date">
                        {new Date(pt.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <span className={`points-delta ${pt.points >= 0 ? "positive" : "negative"}`}>
                      {pt.points >= 0 ? `+${pt.points}` : pt.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
