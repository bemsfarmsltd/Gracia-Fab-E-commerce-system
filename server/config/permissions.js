// Who can do what in the admin portal. The owner (the MD; accounts with
// isAdmin) can do everything. Staff get the list below. Anything not listed
// for staff is owner-only. See docs/ADMIN_APP_PLAN.md, "Roles".

export const PERMISSIONS = {
  "orders.view": "See orders and the Order Board",
  "orders.fulfil": "Move orders through packing, shipping and delivery",
  "orders.cancel": "Cancel orders and record refunds",
  "products.view": "See products",
  "products.edit": "Add, edit and delete products, change prices and photos",
  "stock.count": "Set stock counts (counting, receiving deliveries)",
  "stocktake.approve": "Approve a stock take (apply its differences) or cancel one",
  "store.sell": "Sell at the shop till and see their own sales today",
  "store.void": "Void shop sales",
  "customers.view": "See customers and their order history",
  "customers.notes": "Add notes on customers",
  "customers.export": "Delete notes, download customer and order data",
  "bookings": "Manage in-store bookings",
  "messages": "Read and answer contact messages",
  "messages.delete": "Delete messages",
  "subscribers": "See and remove newsletter subscribers",
  "vouchers": "Create and change discount vouchers",
  "reports": "See the overview, sales and revenue figures",
  "staff.manage": "Add and remove staff",
  "activity.view": "See the activity log",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

export const STAFF_PERMISSIONS = [
  "orders.view",
  "orders.fulfil",
  "products.view",
  "stock.count",
  "store.sell",
  "customers.view",
  "customers.notes",
  "bookings",
  "messages",
];
