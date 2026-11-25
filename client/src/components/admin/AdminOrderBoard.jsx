import { useState, useMemo } from "react";
import AdminOrderInvoice from "./AdminOrderInvoice";

const COLUMNS = [
  {
    id: "paid",
    title: "Paid",
    badgeLabel: "Ready to Pack",
    nextStatus: "processing",
    nextActionLabel: "Start Packing →",
    color: "#2563EB",
    bgSoft: "rgba(37, 99, 235, 0.08)",
  },
  {
    id: "processing",
    title: "Processing",
    badgeLabel: "Packing in Progress",
    nextStatus: "shipped",
    nextActionLabel: "Mark Shipped →",
    color: "#D97706",
    bgSoft: "rgba(217, 119, 6, 0.08)",
  },
  {
    id: "shipped",
    title: "Shipped",
    badgeLabel: "In Transit / Dispatched",
    nextStatus: "delivered",
    nextActionLabel: "Mark Delivered →",
    color: "#7C3AED",
    bgSoft: "rgba(124, 58, 237, 0.08)",
  },
  {
    id: "delivered",
    title: "Delivered",
    badgeLabel: "Delivered to Customer",
    nextStatus: null,
    nextActionLabel: null,
    color: "#059669",
    bgSoft: "rgba(5, 150, 105, 0.08)",
  },
];

// Strict order state machine: Paid -> Processing -> Shipped -> Delivered
const VALID_NEXT_STATUS = {
  paid: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export default function AdminOrderBoard({
  orders = [],
  loading = false,
  fetchOrders,
  handleUpdateStatus,
  formatPrice,
  setAdminError,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMobileColumn, setActiveMobileColumn] = useState("all");
  const [draggedOrderId, setDraggedOrderId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);
  const [movingOrderId, setMovingOrderId] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  // Eligible orders: must be paid, not cancelled, and in one of the 4 workflow statuses
  const boardOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (!o) return false;
      if (!o.isPaid) return false; // Pending/unpaid orders are excluded
      if (o.status === "cancelled") return false; // Cancelled orders excluded
      return ["paid", "processing", "shipped", "delivered"].includes(o.status);
    });
  }, [orders]);

  // Filtered by search term
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return boardOrders;
    const q = searchTerm.toLowerCase().trim();
    return boardOrders.filter((order) => {
      const shortId = order._id?.slice(-6).toLowerCase() || "";
      const customerName = (order.user?.name || order.shippingAddress?.fullName || "").toLowerCase();
      const customerPhone = (order.shippingAddress?.phone || order.user?.phone || "").toLowerCase();
      const city = (order.shippingAddress?.city || "").toLowerCase();
      const state = (order.shippingAddress?.state || "").toLowerCase();
      const itemNames = (order.orderItems || []).map((i) => i.name.toLowerCase()).join(" ");

      return (
        shortId.includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        itemNames.includes(q)
      );
    });
  }, [boardOrders, searchTerm]);

  // Group orders by column
  const ordersByCol = useMemo(() => {
    const map = { paid: [], processing: [], shipped: [], delivered: [] };
    filteredOrders.forEach((o) => {
      if (map[o.status]) {
        map[o.status].push(o);
      }
    });
    return map;
  }, [filteredOrders]);

  // Total counts & revenue values per column
  const colStats = useMemo(() => {
    const stats = {};
    COLUMNS.forEach((col) => {
      const list = ordersByCol[col.id] || [];
      const totalAmount = list.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
      stats[col.id] = { count: list.length, totalAmount };
    });
    return stats;
  }, [ordersByCol]);

  // Check if transition is valid
  const isValidTransition = (currentStatus, targetStatus) => {
    return VALID_NEXT_STATUS[currentStatus] === targetStatus;
  };

  // Move order handler with confirmation
  const handleMoveOrder = async (order, targetStatus) => {
    if (!order || !targetStatus) return;

    if (!isValidTransition(order.status, targetStatus)) {
      if (order.status === targetStatus) return; // Dropped in same column, no-op
      if (setAdminError) {
        setAdminError(
          `Cannot move order directly from "${order.status}" to "${targetStatus}". Progression must strictly follow: Paid → Processing → Shipped → Delivered.`
        );
      }
      return;
    }

    const shortId = order._id.slice(-6).toUpperCase();
    const confirmed = window.confirm(
      `Move order #${shortId} to "${targetStatus}"?${
        targetStatus === "shipped" || targetStatus === "delivered"
          ? "\n\nThe customer will get an email and a WhatsApp message."
          : ""
      }`
    );

    if (!confirmed) return;

    setMovingOrderId(order._id);
    try {
      // handleUpdateStatus shows its own success or error message.
      if (handleUpdateStatus) {
        await handleUpdateStatus(order, targetStatus);
      }
    } catch (err) {
      if (setAdminError) {
        setAdminError(err.message || "Failed to update order status.");
      }
    } finally {
      setMovingOrderId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, order) => {
    setDraggedOrderId(order._id);
    e.dataTransfer.setData("text/plain", order._id);
    e.dataTransfer.setData("application/gracia-order-status", order.status);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e) => {
    // Only clear if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColId(null);
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const orderId = e.dataTransfer.getData("text/plain") || draggedOrderId;
    if (!orderId) return;

    const droppedOrder = boardOrders.find((o) => o._id === orderId);
    if (!droppedOrder) return;

    if (droppedOrder.status === targetColId) return; // Same column

    await handleMoveOrder(droppedOrder, targetColId);
  };

  // Format date helper (Lagos time / locale)
  const formatOrderDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="admin-kanban-wrapper">
      {/* Kanban Header & Controls */}
      <div className="admin-kanban-toolbar">
        <div className="admin-kanban-info">
          <h2 className="admin-kanban-title">Order Fulfillment Workflow</h2>
          <span className="admin-kanban-count-tag">
            {boardOrders.length} active {boardOrders.length === 1 ? "order" : "orders"} on board
          </span>
        </div>

        <div className="admin-kanban-actions">
          {/* Search Bar */}
          <div className="admin-kanban-search">
            <span className="kanban-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="kanban-search-input"
              placeholder="Search by order #, customer, item, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search order board"
            />
            {searchTerm && (
              <button
                type="button"
                className="kanban-search-clear"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          {fetchOrders && (
            <button
              type="button"
              className="kanban-refresh-btn"
              onClick={fetchOrders}
              disabled={loading}
              title="Refresh order board"
              aria-label="Refresh orders"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Mobile Column Quick Selector */}
      <div className="admin-kanban-mobile-tabs" role="tablist" aria-label="Order board columns">
        <button
          type="button"
          role="tab"
          aria-selected={activeMobileColumn === "all"}
          className={`kanban-mobile-tab ${activeMobileColumn === "all" ? "active" : ""}`}
          onClick={() => setActiveMobileColumn("all")}
        >
          All Columns ({boardOrders.length})
        </button>
        {COLUMNS.map((col) => (
          <button
            key={col.id}
            type="button"
            role="tab"
            aria-selected={activeMobileColumn === col.id}
            className={`kanban-mobile-tab ${activeMobileColumn === col.id ? "active" : ""}`}
            onClick={() => setActiveMobileColumn(col.id)}
          >
            {col.title} ({colStats[col.id]?.count || 0})
          </button>
        ))}
      </div>

      {/* Kanban Columns Grid */}
      {loading ? (
        <div className="admin-kanban-loading">
          <p>Loading order board...</p>
        </div>
      ) : (
        <div className="admin-kanban-board" role="region" aria-label="Kanban board">
          {COLUMNS.map((col) => {
            const isColVisibleOnMobile =
              activeMobileColumn === "all" || activeMobileColumn === col.id;
            const ordersInCol = ordersByCol[col.id] || [];
            const isOver = dragOverColId === col.id;

            return (
              <div
                key={col.id}
                className={`kanban-column ${!isColVisibleOnMobile ? "mobile-hidden" : ""} ${
                  isOver ? "drag-over" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                data-testid={`kanban-column-${col.id}`}
              >
                {/* Column Header */}
                <div
                  className="kanban-col-header"
                  style={{ borderTopColor: col.color }}
                >
                  <div className="kanban-col-title-row">
                    <div className="kanban-col-heading">
                      <span
                        className="kanban-col-dot"
                        style={{ backgroundColor: col.color }}
                        aria-hidden="true"
                      />
                      <h3 className="kanban-col-title">{col.title}</h3>
                    </div>
                    <span className="kanban-col-count-badge">
                      {ordersInCol.length}
                    </span>
                  </div>

                  <div className="kanban-col-meta-row">
                    <span className="kanban-col-subtitle">{col.badgeLabel}</span>
                    <span className="kanban-col-value">
                      {formatPrice ? formatPrice(colStats[col.id]?.totalAmount || 0) : `₦${colStats[col.id]?.totalAmount || 0}`}
                    </span>
                  </div>
                </div>

                {/* Column Dropzone / Cards Container */}
                <div className="kanban-cards-list">
                  {ordersInCol.length === 0 ? (
                    <div className="kanban-empty-col">
                      <span className="kanban-empty-icon" aria-hidden="true">📭</span>
                      <p className="kanban-empty-text">
                        {searchTerm ? "No matching orders" : `No orders in ${col.title.toLowerCase()}`}
                      </p>
                    </div>
                  ) : (
                    ordersInCol.map((order) => {
                      const shortId = order._id.slice(-6).toUpperCase();
                      const isDragging = draggedOrderId === order._id;
                      const isMoving = movingOrderId === order._id;
                      const customerName =
                        order.user?.name ||
                        order.shippingAddress?.fullName ||
                        "Customer";
                      const customerPhone =
                        order.shippingAddress?.phone || order.user?.phone || "";
                      const destination = [
                        order.shippingAddress?.city,
                        order.shippingAddress?.state,
                      ]
                        .filter(Boolean)
                        .join(", ");
                      const itemsCount = (order.orderItems || []).reduce(
                        (sum, i) => sum + (Number(i.qty) || 1),
                        0
                      );

                      return (
                        <div
                          key={order._id}
                          className={`kanban-card ${isDragging ? "is-dragging" : ""} ${
                            isMoving ? "is-updating" : ""
                          }`}
                          draggable={Boolean(col.nextStatus)}
                          onDragStart={(e) => handleDragStart(e, order)}
                          onDragEnd={handleDragEnd}
                          data-testid={`kanban-card-${order._id}`}
                        >
                          {/* Card Top Row: Order ID & Date */}
                          <div className="kanban-card-top">
                            <span className="kanban-card-id">#{shortId}</span>
                            <span className="kanban-card-date">
                              {formatOrderDate(order.createdAt)}
                            </span>
                          </div>

                          {/* Customer Details */}
                          <div className="kanban-card-customer">
                            <span className="kanban-customer-name" title={customerName}>
                              👤 {customerName}
                            </span>
                            {customerPhone && (
                              <a
                                href={`tel:${customerPhone}`}
                                className="kanban-customer-phone"
                                title="Call customer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📞 {customerPhone}
                              </a>
                            )}
                            {destination && (
                              <span className="kanban-customer-dest" title={destination}>
                                📍 {destination}
                              </span>
                            )}
                          </div>

                          {/* Order Items Preview */}
                          <div className="kanban-card-items">
                            <div className="kanban-items-summary">
                              <span className="kanban-items-count">
                                📦 {itemsCount} {itemsCount === 1 ? "item" : "items"}
                              </span>
                            </div>
                            <ul className="kanban-items-preview-list">
                              {(order.orderItems || []).slice(0, 2).map((item, idx) => (
                                <li key={idx} className="kanban-item-preview-line">
                                  <span className="item-qty">{item.qty}×</span>{" "}
                                  <span className="item-name">{item.name}</span>
                                </li>
                              ))}
                              {(order.orderItems || []).length > 2 && (
                                <li className="kanban-item-preview-more">
                                  +{(order.orderItems || []).length - 2} more item(s)
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Card Footer: Total Price & Advance Action */}
                          <div className="kanban-card-footer">
                            <div className="kanban-card-price-block">
                              <span className="kanban-price-label">Total</span>
                              <span className="kanban-card-price">
                                {formatPrice
                                  ? formatPrice(order.totalPrice)
                                  : `₦${Number(order.totalPrice || 0).toLocaleString()}`}
                              </span>
                            </div>

                            {/* Move Action & Invoice Buttons */}
                            <div className="kanban-card-action-group">
                              <button
                                type="button"
                                className="kanban-card-invoice-btn"
                                onClick={() => setInvoiceOrder(order)}
                                title="View & print invoice"
                                aria-label={`Invoice for order #${shortId}`}
                              >
                                🧾
                              </button>
                              {col.nextStatus ? (
                                <button
                                  type="button"
                                  className="kanban-card-advance-btn"
                                  onClick={() => handleMoveOrder(order, col.nextStatus)}
                                  disabled={isMoving}
                                  title={`Move to ${col.nextStatus} (sends customer update)`}
                                  data-testid={`advance-btn-${order._id}`}
                                >
                                  {isMoving ? "Updating..." : col.nextActionLabel}
                                </button>
                              ) : (
                                <span className="kanban-card-delivered-pill" aria-label="Delivered">
                                  ✓ Completed
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Drag Handle Indicator */}
                          {col.nextStatus && (
                            <div
                              className="kanban-card-drag-handle"
                              title="Drag to next column"
                              aria-hidden="true"
                            >
                              ⋮⋮
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
