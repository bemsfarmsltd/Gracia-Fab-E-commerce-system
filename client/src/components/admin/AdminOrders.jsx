import { useState, useMemo, useEffect } from "react";
import { downloadOrdersCsv } from "../../utils/adminDownload";
import API_URL from "../../config";
import AdminOrderInvoice from "./AdminOrderInvoice";

const statusColors = {
  pending: "#f39c12",
  processing: "#3498db",
  shipped: "#9b59b6",
  delivered: "#27ae60",
  cancelled: "#e74c3c",
};

const PAGE_SIZE = 20;

export default function AdminOrders({
  orders = [],
  loading = false,
  fetchOrders,
  handleUpdateStatus,
  handleMarkRefunded,
  formatPrice,
  initialStatusFilter = "all",
  setAdminError,
  setAdminNotice,
  getHeaders,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [inspectOrder, setInspectOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Update filter if initialStatusFilter changes from outside (e.g. Overview chip click)
  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      setCurrentPage(1);
    }
  }, [initialStatusFilter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filter & Search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const shortId = order._id.slice(-8).toLowerCase();
        const fullId = order._id.toLowerCase();
        const customerName = (order.user?.name || order.deliveryAddress?.fullName || "").toLowerCase();
        const customerEmail = (order.user?.email || "").toLowerCase();
        const customerPhone = (order.deliveryAddress?.phone || "").toLowerCase();
        const matchesQuery =
          shortId.includes(query) ||
          fullId.includes(query) ||
          customerName.includes(query) ||
          customerEmail.includes(query) ||
          customerPhone.includes(query);
        if (!matchesQuery) return false;
      }
      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [orders, statusFilter, searchTerm, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset page if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);
  /* eslint-enable react-hooks/set-state-in-effect */


  // Checkbox Selection
  const allOnPageSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selectedIds.has(o._id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedOrders.forEach((o) => next.delete(o._id));
      } else {
        paginatedOrders.forEach((o) => next.add(o._id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk Status Update via PUT /api/admin/orders/status
  const handleBulkStatus = async (status) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    setAdminError("");
    setAdminNotice("");

    try {
      const ids = Array.from(selectedIds);
      const res = await fetch(`${API_URL}/api/admin/orders/status`, {
        method: "PUT",
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ids, status }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update selected orders");
      }

      const updatedCount = data.updated?.length || 0;
      const failed = data.failed || [];

      if (failed.length === 0) {
        setAdminNotice(`${updatedCount} order(s) successfully marked ${status}.`);
      } else {
        const failedMessages = failed.map((f) => f.message).join("; ");
        setAdminError(
          `${updatedCount} updated, ${failed.length} couldn't: ${failedMessages}`
        );
        if (updatedCount > 0) {
          setAdminNotice(`${updatedCount} order(s) marked ${status}.`);
        }
      }

      clearSelection();
      if (fetchOrders) fetchOrders();
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <div className="admin-content admin-orders-view">
      {/* ── TOOLBAR: FILTERS, SEARCH, CSV EXPORT ── */}
      <div className="orders-control-panel">
        <div className="orders-toolbar-top">
          {/* Status Tabs */}
          <div className="orders-status-filters" role="tablist" aria-label="Filter orders by status">
            {[
              { id: "all", label: "All Orders", count: orders.length },
              { id: "pending", label: "Pending", count: orders.filter((o) => o.status === "pending").length },
              { id: "processing", label: "Processing", count: orders.filter((o) => o.status === "processing").length },
              { id: "shipped", label: "Shipped", count: orders.filter((o) => o.status === "shipped").length },
              { id: "delivered", label: "Delivered", count: orders.filter((o) => o.status === "delivered").length },
              { id: "cancelled", label: "Cancelled", count: orders.filter((o) => o.status === "cancelled").length },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                className={`orders-filter-btn ${statusFilter === f.id ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(f.id);
                  setCurrentPage(1);
                }}
              >
                <span>{f.label}</span>
                <span className="filter-count-badge">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            type="button"
            className="btn-admin-cancel export-csv-btn"
            onClick={async () => {
              try {
                await downloadOrdersCsv();
              } catch (err) {
                setAdminError(err.message);
              }
            }}
            title="Download full orders spreadsheet"
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* Search & Sort Row */}
        <div className="orders-toolbar-bottom">
          <div className="orders-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search by Order #, customer name, email or phone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="orders-search-input"
              aria-label="Search orders"
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="orders-sort-wrap">
            <label htmlFor="orders-sort-select" className="sort-label">Sort:</label>
            <select
              id="orders-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="orders-sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── BULK ACTION FLOATING BAR ── */}
      {selectedIds.size > 0 && (
        <div className="admin-bulk-bar" role="region" aria-label="Bulk actions">
          <div className="bulk-bar-info">
            <span className="bulk-badge">{selectedIds.size}</span>
            <span className="bulk-label">{selectedIds.size} order(s) selected</span>
          </div>

          <div className="bulk-bar-actions">
            <button
              type="button"
              className="bulk-btn mark-processing"
              onClick={() => handleBulkStatus("processing")}
              disabled={bulkProcessing}
            >
              Mark Processing
            </button>
            <button
              type="button"
              className="bulk-btn mark-shipped"
              onClick={() => handleBulkStatus("shipped")}
              disabled={bulkProcessing}
            >
              Mark Shipped
            </button>
            <button
              type="button"
              className="bulk-btn mark-delivered"
              onClick={() => handleBulkStatus("delivered")}
              disabled={bulkProcessing}
            >
              Mark Delivered
            </button>
            <button
              type="button"
              className="bulk-btn bulk-clear"
              onClick={clearSelection}
              disabled={bulkProcessing}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── ORDERS TABLE ── */}
      {loading ? (
        <p className="admin-loading">Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-empty-state">
          <p className="empty-title">No orders found</p>
          <p className="empty-sub">
            {searchTerm
              ? `No orders matching "${searchTerm}" under "${statusFilter}" filter.`
              : `There are currently no orders under the "${statusFilter}" status.`}
          </p>
          {(searchTerm || statusFilter !== "all") && (
            <button
              type="button"
              className="btn-admin-cancel"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table modern-orders-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all orders on this page"
                  />
                </th>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Update Status</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const isSelected = selectedIds.has(order._id);
                const itemsCount = order.orderItems?.length || 0;
                const itemsSummary =
                  itemsCount === 1
                    ? order.orderItems[0].name
                    : `${itemsCount} item${itemsCount !== 1 ? "s" : ""}`;

                return (
                  <tr key={order._id} className={isSelected ? "row-selected" : ""}>
                    {/* Checkbox */}
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(order._id)}
                        aria-label={`Select order ${order._id}`}
                      />
                    </td>

                    {/* Order ID */}
                    <td className="cell-code">
                      <button
                        type="button"
                        className="order-id-link"
                        onClick={() => setInspectOrder(order)}
                        title="View order details"
                      >
                        #{order._id.slice(-8).toUpperCase()}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="cell-date">
                      {new Date(order.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Customer */}
                    <td>
                      <div className="cell-user-wrap">
                        <span className="cell-user-name">
                          {order.user?.name || order.deliveryAddress?.fullName || "Guest"}
                        </span>
                        <span className="cell-sub">{order.user?.email || "No email recorded"}</span>
                      </div>
                    </td>

                    {/* Items */}
                    <td className="cell-items" title={order.orderItems?.map((i) => `${i.name} (x${i.quantity})`).join(", ")}>
                      {itemsSummary}
                    </td>

                    {/* Total */}
                    <td className="cell-price">{formatPrice(order.totalPrice)}</td>

                    {/* Payment Pill */}
                    <td>
                      <span className={`pay-pill ${order.isPaid ? "paid" : "unpaid"}`}>
                        {order.isPaid ? "✅ Paid" : "⏳ Unpaid"}
                      </span>
                    </td>

                    {/* Status Pill & Refund Badges */}
                    <td>
                      <span
                        className="status-pill"
                        style={{ background: statusColors[order.status] || "#7A2432" }}
                      >
                        {order.status}
                      </span>

                      {/* Refund Due badge */}
                      {order.refund?.status === "pending" && (
                        <div className="order-refund-due">
                          Refund due {formatPrice(order.refund.amount)}
                          <button
                            type="button"
                            className="btn-edit"
                            onClick={() => handleMarkRefunded(order)}
                          >
                            Mark refunded
                          </button>
                        </div>
                      )}

                      {/* Refunded Complete */}
                      {order.refund?.status === "refunded" && (
                        <div className="order-refund-done" title={order.refund.reference}>
                          Refunded ✓
                        </div>
                      )}
                    </td>

                    {/* Single-Order Status Selector (Preserved for tests & one-off changes) */}
                    <td>
                      <select
                        className="status-select"
                        value={order.status}
                        aria-label={`Update status for order ${order._id}`}
                        disabled={order.status === "cancelled"}
                        onChange={(e) => handleUpdateStatus(order, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        {/* Set only when Monnify confirms payment; listed so a
                            paid order doesn't read as "Pending". */}
                        <option value="paid" disabled>Paid</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>

                    {/* Actions Menu */}
                    <td className="td-actions">
                      <div className="orders-row-actions">
                        <button
                          type="button"
                          className="btn-inspect-order"
                          onClick={() => setInspectOrder(order)}
                          title="Inspect order details"
                          aria-label={`Inspect order ${order._id}`}
                        >
                          👁 View
                        </button>
                        <button
                          type="button"
                          className="btn-order-invoice"
                          onClick={() => setInvoiceOrder(order)}
                          title="View & print invoice"
                          aria-label={`Invoice for order ${order._id}`}
                        >
                          🧾 Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAGINATION CONTROLS ── */}
      {filteredOrders.length > 0 && (
        <div className="orders-pagination">
          <div className="pagination-count">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} order(s)
          </div>

          {totalPages > 1 && (
            <div className="pagination-buttons">
              <button
                type="button"
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                « Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`page-btn ${currentPage === num ? "active" : ""}`}
                  onClick={() => setCurrentPage(num)}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                className="page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next »
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── INSPECT ORDER MODAL / DRAWER ── */}
      {inspectOrder && (
        <div className="order-modal-backdrop" onClick={() => setInspectOrder(null)}>
          <div
            className="order-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Order Details"
          >
            <div className="order-modal-header">
              <div>
                <span className="order-modal-subtitle">Order Reference</span>
                <h3 className="order-modal-title">#{inspectOrder._id.slice(-8).toUpperCase()}</h3>
              </div>
              <button
                type="button"
                className="order-modal-close"
                onClick={() => setInspectOrder(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="order-modal-body">
              {/* Status & Summary */}
              <div className="modal-summary-grid">
                <div className="modal-summary-item">
                  <span className="item-label">Status</span>
                  <span className="status-pill" style={{ background: statusColors[inspectOrder.status] }}>
                    {inspectOrder.status}
                  </span>
                </div>
                <div className="modal-summary-item">
                  <span className="item-label">Payment</span>
                  <span className={`pay-pill ${inspectOrder.isPaid ? "paid" : "unpaid"}`}>
                    {inspectOrder.isPaid ? "Paid" : "Unpaid"}
                  </span>
                </div>
                <div className="modal-summary-item">
                  <span className="item-label">Total Amount</span>
                  <span className="item-value font-bold">{formatPrice(inspectOrder.totalPrice)}</span>
                </div>
                <div className="modal-summary-item">
                  <span className="item-label">Placed On</span>
                  <span className="item-value">
                    {new Date(inspectOrder.createdAt).toLocaleString("en-NG")}
                  </span>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="modal-section">
                <h4 className="modal-section-title">Delivery Details</h4>
                <div className="modal-address-box">
                  <p><strong>Recipient:</strong> {inspectOrder.deliveryAddress?.fullName || inspectOrder.user?.name || "Customer"}</p>
                  <p><strong>Phone:</strong> {inspectOrder.deliveryAddress?.phone || "No phone provided"}</p>
                  <p><strong>Address:</strong> {inspectOrder.deliveryAddress?.streetAddress || "Not specified"}</p>
                  <p><strong>City / State:</strong> {inspectOrder.deliveryAddress?.city}, {inspectOrder.deliveryAddress?.state || "Abia"}</p>
                </div>
              </div>

              {/* Ordered Items */}
              <div className="modal-section">
                <h4 className="modal-section-title">Ordered Items ({inspectOrder.orderItems?.length || 0})</h4>
                <div className="modal-items-list">
                  {inspectOrder.orderItems?.map((item, idx) => (
                    <div key={idx} className="modal-item-row">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="modal-item-img" />
                      )}
                      <div className="modal-item-meta">
                        <span className="modal-item-name">{item.name}</span>
                        <span className="modal-item-sub">
                          Qty: {item.quantity} × {formatPrice(item.price)}
                        </span>
                      </div>
                      <span className="modal-item-total">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-modal-footer">
              <button
                type="button"
                className="btn-invoice-print"
                onClick={() => {
                  const target = inspectOrder;
                  setInspectOrder(null);
                  setInvoiceOrder(target);
                }}
              >
                🧾 Print Invoice
              </button>
              <button
                type="button"
                className="btn-admin-cancel"
                onClick={() => setInspectOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE INVOICE MODAL ── */}
      {invoiceOrder && (
        <AdminOrderInvoice
          order={invoiceOrder}
          formatPrice={formatPrice}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
