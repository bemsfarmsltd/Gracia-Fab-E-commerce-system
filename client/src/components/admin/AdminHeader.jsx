import { useNavigate } from "react-router-dom";

const TAB_TITLES = {
  overview: { title: "Store Overview", subtitle: "Performance, real sales figures and inventory health" },
  orders: { title: "Orders Management", subtitle: "Filter, track and process customer orders" },
  orderboard: { title: "Order Board", subtitle: "Visual workflow from payment to packing, shipping and delivery" },
  products: { title: "Product Catalogue", subtitle: "Manage stock items, pricing and photography" },
  inventory: { title: "Inventory & Stock Levels", subtitle: "Real-time counts, thresholds and CSV bulk updates" },
  vouchers: { title: "Discount Vouchers", subtitle: "Promo codes, minimum spend and campaign limits" },
  sales: { title: "Sales & Financial Reports", subtitle: "Historical revenue trends and CSV export" },
  users: { title: "Customers & Accounts", subtitle: "Registered customer directory and contact details" },
  bookings: { title: "In-Store & Bridal Bookings", subtitle: "Manage salon appointments, wig installs, bridal makeup and MD consultations" },
  messages: { title: "Customer Inquiries", subtitle: "Messages submitted via the contact and support form" },
  subscribers: { title: "Newsletter Subscribers", subtitle: "Email list subscriptions from storefront footer" },
};

export default function AdminHeader({
  activeTab,
  setMobileOpen,
  adminError,
  adminNotice,
  user,
}) {
  const navigate = useNavigate();
  const current = TAB_TITLES[activeTab] || { title: "Admin Console", subtitle: "Manage your Gracia Fab store" };

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-main">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="admin-hamburger-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <span className="hamburger-icon" aria-hidden="true">☰</span>
        </button>

        {/* Current Section Title & Breadcrumb */}
        <div className="admin-topbar-headings">
          <div className="admin-breadcrumb">
            <span className="breadcrumb-root">Gracia Fab</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-curr">{current.title}</span>
          </div>
          <h1 className="admin-section-heading">{current.title}</h1>
          <p className="admin-section-sub">{current.subtitle}</p>
        </div>

        {/* Right side actions */}
        <div className="admin-topbar-actions">
          <button
            type="button"
            className="admin-back-to-store"
            onClick={() => navigate("/")}
            title="Return to the storefront"
          >
            ← Back to Store
          </button>
          <div className="admin-topbar-user" title={`Logged in as ${user?.email || "Admin"}`}>
            <span className="topbar-user-badge">👑 Admin</span>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {adminError && (
        <div className="admin-error" role="alert">
          ⚠️ {adminError}
        </div>
      )}
      {adminNotice && (
        <div className="admin-success" role="status">
          ✅ {adminNotice}
        </div>
      )}
    </header>
  );
}
