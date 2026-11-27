import { canSeeTab } from "../../utils/portal";

const NAV_SECTIONS = [
  {
    heading: "Dashboard",
    items: [
      { id: "overview", label: "Overview", icon: "📊" },
    ],
  },
  {
    heading: "Store & Commerce",
    items: [
      { id: "orders", label: "Orders", icon: "📦" },
      { id: "orderboard", label: "Order Board", icon: "📋" },
      { id: "products", label: "Products", icon: "🛍️" },
      { id: "inventory", label: "Inventory", icon: "🏷️" },
    ],
  },
  {
    heading: "Customers & Care",
    items: [
      { id: "users", label: "Customers", icon: "👥" },
      { id: "messages", label: "Messages", icon: "💌" },
      { id: "subscribers", label: "Subscribers", icon: "📧" },
    ],
  },
  {
    heading: "Analytics & Promo",
    items: [
      { id: "sales", label: "Sales", icon: "📈" },
      { id: "vouchers", label: "Vouchers", icon: "🎟️" },
    ],
  },
  {
    heading: "In-Store & Bridal",
    items: [
      { id: "bookings", label: "Bookings", icon: "📅" },
    ],
  },
  {
    heading: "Team",
    items: [
      { id: "staff", label: "Staff", icon: "🧑‍💼" },
    ],
  },
];

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  user,
  logout,
}) {
  const handleTabClick = (tabId, disabled) => {
    if (disabled) return;
    setActiveTab(tabId);
    if (mobileOpen) setMobileOpen(false);
  };

  // Only the sections this person's role allows (staff see fewer); groups
  // left empty are hidden.
  const sections = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => canSeeTab(user, item.id)) }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Admin Navigation">
        {/* Brand Header */}
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-brand">
            <span className="admin-brand-logo" aria-hidden="true">
              <img src="/icons/icon-192.png" alt="" width="44" height="44" />
            </span>
            <div className="admin-brand-text">
              <span className="admin-brand-title">GRACIA FAB</span>
              <span className="admin-brand-tag">ADMIN PORTAL</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-sidebar-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="admin-sidebar-nav">
          {sections.map((section) => (
            <div key={section.heading} className="admin-nav-group">
              <span className="admin-nav-heading">{section.heading}</span>
              <ul className="admin-nav-list">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id} className="admin-nav-item">
                      <button
                        type="button"
                        className={`admin-nav-link ${isActive ? "active" : ""} ${item.disabled ? "is-disabled" : ""}`}
                        onClick={() => handleTabClick(item.id, item.disabled)}
                        disabled={item.disabled}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="admin-nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="admin-nav-label">{item.label}</span>
                        {item.badge && (
                          <span className="admin-nav-badge">{item.badge}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Admin profile & quick store view */}
        <div className="admin-sidebar-footer">
          {/* A plain link: the shop is a different app from the admin. */}
          <a href="/" className="admin-nav-view-store">
            <span aria-hidden="true">←</span> View Storefront
          </a>
          <div className="admin-sidebar-user">
            <div className="admin-user-avatar" aria-hidden="true">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name">{user?.name || "Administrator"}</span>
              <span className="admin-user-role">{user?.isAdmin ? "Owner" : "Staff"}</span>
            </div>
            {logout && (
              <button
                type="button"
                className="admin-logout-btn"
                onClick={logout}
                title="Log out of admin console"
                aria-label="Log out"
              >
                ⎋
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
