// Who may use the admin portal and which parts they see. The server checks
// every request again (server/config/permissions.js); this only decides what
// to show. Sessions saved before roles existed have just isAdmin: the owner.

export const canUsePortal = (user) => Boolean(user && (user.isAdmin || user.role === "staff"));

export const isOwner = (user) => Boolean(user?.isAdmin);

export function can(user, permission) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

// The permission each admin section needs.
export const TAB_PERMISSIONS = {
  overview: "reports",
  orders: "orders.view",
  orderboard: "orders.view",
  products: "products.view",
  inventory: "stock.count",
  users: "customers.view",
  messages: "messages",
  subscribers: "subscribers",
  sales: "reports",
  vouchers: "vouchers",
  bookings: "bookings",
  staff: "staff.manage",
  activity: "activity.view",
};

export const canSeeTab = (user, tab) => can(user, TAB_PERMISSIONS[tab] ?? "staff.manage");

// Where someone lands: the owner on the Overview, staff on the Order Board.
const HOME_ORDER = ["overview", "orderboard", "orders", "bookings", "inventory", "messages"];
export const homeTab = (user) => HOME_ORDER.find((t) => canSeeTab(user, t)) || "orderboard";
