import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import InventoryPanel from "../components/InventoryPanel";
import VoucherPanel from "../components/VoucherPanel";
import SalesPanel from "../components/SalesPanel";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminHeader from "../components/admin/AdminHeader";
import AdminOverview from "../components/admin/AdminOverview";
import AdminOrders from "../components/admin/AdminOrders";
import AdminOrderBoard from "../components/admin/AdminOrderBoard";
import AdminProducts from "../components/admin/AdminProducts";
import AdminCustomers from "../components/admin/AdminCustomers";
import AdminBookings from "../components/admin/AdminBookings";
import AdminMessages from "../components/admin/AdminMessages";
import AdminStaff from "../components/admin/AdminStaff";
import AdminTill from "../components/admin/AdminTill";
import AdminLabels from "../components/admin/AdminLabels";
import AdminStockTake from "../components/admin/AdminStockTake";
import AdminSuppliers from "../components/admin/AdminSuppliers";
import AdminTour from "../components/tour/AdminTour";
import InstallApp from "../components/install/InstallApp";
import { tourSeen } from "../components/tour/useFirstRunTour";
import { adminTourKey } from "../components/tour/adminSteps";
import "../styles/Admin.css";
import "../styles/AdminDashLite.css";
import API_URL from "../config";
import { canUsePortal, canSeeTab, homeTab } from "../utils/portal";

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Staff start on the Order Board; the owner on the Overview.
  const [activeTab, setActiveTab] = useState(() => homeTab(user));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");

  const getHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  // GETs an admin endpoint. On failure the API returns { message } instead of
  // the expected list; storing that and then calling .map() on it crashed the
  // whole page to a blank screen. So: an expired session goes back to login,
  // other errors show a banner, and callers only store data on success.
  const loadAdminData = useCallback(async (path) => {
    const res = await fetch(`${API_URL}${path}`, { headers: getHeaders() });
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      logout();
      navigate("/login");
      return null;
    }
    if (!res.ok) {
      setAdminError(data?.message || "Couldn't load this section. Please try again.");
      return null;
    }
    setAdminError("");
    return data;
  }, [getHeaders, logout, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      await Promise.resolve();
      setLoading(true);
      await loadAdminData("/api/admin/stats");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadAdminData]);

  const fetchProducts = useCallback(async () => {
    try {
      await Promise.resolve();
      setLoading(true);
      const data = await loadAdminData("/api/admin/products");
      if (Array.isArray(data)) setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadAdminData]);

  const fetchOrders = useCallback(async () => {
    try {
      await Promise.resolve();
      setLoading(true);
      const data = await loadAdminData("/api/admin/orders");
      if (Array.isArray(data)) setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadAdminData]);

  const fetchMessages = useCallback(async () => {
    try {
      await Promise.resolve();
      setMsgLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/contact`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  const fetchSubscribers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/contact/subscribers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubscribers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user) return navigate("/login");
    if (!canUsePortal(user)) return navigate("/");
    // Sales figures are owner-only; staff never request them.
    if (canSeeTab(user, "overview")) fetchStats();
  }, [user, navigate, fetchStats]);

  useEffect(() => {
    if (!canSeeTab(user, activeTab)) return;
    if (activeTab === "overview") fetchStats();
    if (activeTab === "products") fetchProducts();
    if (activeTab === "orders" || activeTab === "orderboard") fetchOrders();
    if (activeTab === "messages") fetchMessages();
    if (activeTab === "subscribers") fetchSubscribers();
  }, [user, activeTab, fetchStats, fetchProducts, fetchOrders, fetchMessages, fetchSubscribers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDeleteSubscriber = async (id) => {
    if (!window.confirm("Remove this subscriber?")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/contact/subscribers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSubscribers();
    } catch (err) {
      console.error(err);
    }
  };

  // Sends an admin order action and reports the outcome (these used to fail
  // silently, e.g. when the status rules rejected a change).
  // Returns true when the change was saved, so callers (e.g. the Order Board)
  // never announce success after a failure.
  const sendOrderAction = async (url, body, successMessage) => {
    setAdminError("");
    setAdminNotice("");
    let ok = false;
    try {
      const res = await fetch(url, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "That didn't work. Please try again.");
      setAdminNotice(successMessage);
      ok = true;
    } catch (err) {
      setAdminError(err.message);
    }
    fetchOrders();
    return ok;
  };

  const handleUpdateStatus = async (order, status) => {
    if (status === "cancelled") {
      const paid = order.isPaid;
      const reason = window.prompt(
        paid
          ? `Cancel this paid order? Stock goes back, and a refund of ${formatPrice(order.totalPrice)} will be recorded as due (send it from the Monnify dashboard). The customer is told by email/WhatsApp.\n\nReason for cancelling:`
          : "Cancel this unpaid order? The customer is told by email/WhatsApp.\n\nReason for cancelling:",
      );
      if (reason === null) return fetchOrders(); // put the menu back
      return sendOrderAction(
        `${API_URL}/api/admin/orders/${order._id}/cancel`,
        { reason: reason.trim() },
        paid ? "Order cancelled. Refund recorded as due." : "Order cancelled.",
      );
    }
    // Only shipped and delivered send the customer an email and WhatsApp.
    const told = status === "shipped" || status === "delivered" ? " The customer has been told by email and WhatsApp." : "";
    return sendOrderAction(`${API_URL}/api/admin/orders/${order._id}`, { status }, `Order marked ${status}.${told}`);
  };

  const handleMarkRefunded = (order) => {
    const reference = window.prompt(
      `Have you sent the ${formatPrice(order.refund.amount)} refund from the Monnify dashboard?\n\nEnter Monnify's refund reference:`,
    );
    if (!reference || !reference.trim()) return;
    sendOrderAction(
      `${API_URL}/api/admin/orders/${order._id}/refund`,
      { reference: reference.trim() },
      "Refund recorded. The customer has been told.",
    );
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);

  if (!canUsePortal(user)) return null;

  return (
    <div className="admin-dashlite-layout">
      <AdminTour user={user} onOpenMenu={setMobileOpen} />
      <InstallApp appName="Gracia Fab Admin" icon="/icons/admin-icon-192.png" storageKey="gf-install-admin" delay={4000} waitFor={() => tourSeen(adminTourKey(user))} />
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === "orders") setOrdersStatusFilter("all");
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        user={user}
        logout={logout}
      />
      <main className="admin-main-viewport">
        <AdminHeader
          activeTab={activeTab}
          setMobileOpen={setMobileOpen}
          adminError={adminError}
          adminNotice={adminNotice}
          user={user}
        />

        {/* ── INVENTORY ── */}
        {activeTab === "suppliers" && canSeeTab(user, "suppliers") && (
          <AdminSuppliers setAdminError={setAdminError} setAdminNotice={setAdminNotice} />
        )}
        {activeTab === "stocktake" && canSeeTab(user, "stocktake") && (
          <AdminStockTake user={user} setAdminError={setAdminError} setAdminNotice={setAdminNotice} />
        )}
        {activeTab === "labels" && canSeeTab(user, "labels") && (
          <AdminLabels user={user} setAdminError={setAdminError} setAdminNotice={setAdminNotice} />
        )}
        {activeTab === "till" && canSeeTab(user, "till") && (
          <AdminTill setAdminError={setAdminError} setAdminNotice={setAdminNotice} />
        )}
        {activeTab === "staff" && canSeeTab(user, "staff") && (
          <AdminStaff setAdminError={setAdminError} setAdminNotice={setAdminNotice} />
        )}
        {activeTab === "inventory" && <InventoryPanel />}

        {/* ── SALES ── */}
        {activeTab === "sales" && <SalesPanel />}

        {/* ── VOUCHERS ── */}
        {activeTab === "vouchers" && <VoucherPanel />}

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <AdminOverview
            onFilterOrders={(status) => {
              setOrdersStatusFilter(status);
              setActiveTab("orders");
            }}
            setActiveTab={setActiveTab}
            getHeaders={getHeaders}
            formatPrice={formatPrice}
          />
        )}

        {/* ── ORDER BOARD ── */}
        {activeTab === "orderboard" && (
          <AdminOrderBoard
            orders={orders}
            loading={loading}
            fetchOrders={fetchOrders}
            handleUpdateStatus={handleUpdateStatus}
            formatPrice={formatPrice}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
            getHeaders={getHeaders}
          />
        )}

        {/* ── PRODUCTS ── */}
        {activeTab === "products" && (
          <AdminProducts
            products={products}
            loading={loading}
            fetchProducts={fetchProducts}
            formatPrice={formatPrice}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
            getHeaders={getHeaders}
          />
        )}

        {/* ── ORDERS ── */}
        {activeTab === "orders" && (
          <AdminOrders
            orders={orders}
            loading={loading}
            fetchOrders={fetchOrders}
            handleUpdateStatus={handleUpdateStatus}
            handleMarkRefunded={handleMarkRefunded}
            formatPrice={formatPrice}
            initialStatusFilter={ordersStatusFilter}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
            getHeaders={getHeaders}
          />
        )}

        {/* ── CUSTOMERS ── */}
        {activeTab === "users" && (
          <AdminCustomers
            getHeaders={getHeaders}
            formatPrice={formatPrice}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
          />
        )}

        {/* ── BOOKINGS ── */}
        {activeTab === "bookings" && (
          <AdminBookings
            getHeaders={getHeaders}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
          />
        )}

        {/* ── Messages Inbox ── */}
        {activeTab === "messages" && (
          <AdminMessages
            messages={messages}
            loading={msgLoading}
            fetchMessages={fetchMessages}
            getHeaders={getHeaders}
            setAdminError={setAdminError}
            setAdminNotice={setAdminNotice}
          />
        )}

        {/* ── Subscribers Tab ── */}
        {activeTab === "subscribers" && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Newsletter Subscribers 📬</h2>
              <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                {subscribers.length} total
              </span>
            </div>

            {subscribers.length === 0 ? (
              <p className="admin-loading">No subscribers yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Subscribed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub, i) => (
                    <tr key={sub._id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.78rem",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>
                        {sub.email}
                      </td>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.78rem",
                        }}
                      >
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteSubscriber(sub._id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
