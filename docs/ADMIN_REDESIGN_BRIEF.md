# Admin dashboard redesign (Antigravity + Claude Code)

Owner request, 22 Nov 2026: rebuild the admin using **DashLite** (react.dashlite.net/demo2)
as **layout inspiration**, keeping Gracia Fab's own look. It goes live **in stages**
(owner chose this; the MD's printed guide gets updated after each stage).

## Ground rules

- **Inspiration only.** DashLite is a paid Softnio template. Don't install it, copy its
  code, CSS, icons or images. Rebuild the layout ideas in our own components.
- **Our look:** tokens in `client/src/index.css` only (`--bg` cream, `--accent` wine,
  `--surface`, `--border`, `--text*`, `--font-display` Playfair, `--font-body` DM Sans).
  No DashLite purple, no new fonts. Never reference an undefined CSS variable.
  Charts use wine and gold (`--accent`, `--accent-2`/`--amber`), never rainbow.
- **No invented numbers.** DashLite's "↑ 4.63% vs last week" is demo data. Show only
  what the API returns; when a comparison has no data (e.g. last week had 0 orders),
  show "No orders last week", not a percentage. The store is small (about 20 orders),
  so empty and quiet states must look good.
- **Phone first.** The MD mostly uses her phone (and the admin installs as an app).
  Check the 15 screens in `docs/RESPONSIVE_AUDIT.md`.
- Keep everything the admin does today working (product form + Cloudinary upload,
  stock CSV, vouchers, cancel/refund flow, CSV export). Keep the existing tests passing.
- Claim in `docs/WORKING_NOW.md` first. `AdminDashboard.jsx` is 1,300 lines: split it
  into `client/src/components/admin/` as you go, one section per file.

## Split

- **Antigravity (look and layout):** the shell (sidebar on desktop, slide-in menu on
  phones, top bar with store name and admin name, "Back to store"), cards, tables,
  status pills, empty states, the order board, invoice design, calendar view.
- **Claude Code (data):** new API endpoints below, tests, wiring help, live checks.

## Stage 1: shell, Overview, Orders

**Shell.** Sidebar sections (DashLite e-commerce panel style): Overview, Orders,
Order board (stage 2), Products, Inventory, Customers, Vouchers, Sales, Messages,
Subscribers, Bookings (stage 3). Replaces the 9 emoji tabs.

**Overview** (like `demo2/ecommerce/index`), data from `GET /api/admin/overview`:
- Big wine card: revenue in the last 30 days + small line chart of `daily[].revenue`,
  and "last 7 days" with the comparison to the 7 days before.
- Cards: average order value; paid orders (7 days vs previous 7); new customers
  (7 vs previous 7), each with a small chart from `daily`.
- Orders by status (pending / processing / shipped / delivered / cancelled) as chips
  that open Orders filtered to that status.
- Stock alerts (already in the API) and recent orders table.

**Orders** (like `demo2/ecommerce/orders`), data from `GET /api/admin/orders`:
- Search by order number or customer name/email, status filter, pagination (20 a page).
- Columns: order #, date, status pill, customer, items ("3 items" or the product name
  when one), total (₦), ⋯ menu (view, change status, cancel, invoice later).
- Checkboxes + bulk action bar: "Mark processing / shipped / delivered" →
  `PUT /api/admin/orders/status`. Show the result ("3 updated, 1 couldn't: …").
  Cancelling stays one order at a time (it needs a reason and may refund).

## Stage 2: order board, Products/Inventory, Customers

- **Order board** (like `demo2/app-kanban`, but for orders): columns Paid → Processing
  (packing) → Shipped → Delivered (the order state machine; no skipping steps). Dragging a card calls the same status endpoint; the customer
  gets the usual shipped/delivered email and WhatsApp, so confirm before the move.
  Pending (unpaid) orders are not on the board.
- **Products** (like `demo2/product-list` / `product-card`): grid/list toggle, photo,
  stock pill, quick edit. Same form and upload as today.
- **Customers** (like `demo2/user-list-regular` + `user-details-regular`): list with
  orders count, total spent, last order, points; a detail page with their orders and a
  staff notes box. API from Claude Code (`/api/admin/customers`, `/:id`, notes).

## Stage 3: Bookings calendar, invoices, Messages inbox

- **Bookings** (like `demo2/app-calender`): staff log salon, wig install, bridal makeup
  and MD consultation bookings taken on WhatsApp/phone: customer name, phone, service
  (`SERVICES` in `client/src/utils/storeInfo.js`), date/time, staff member, notes,
  status. Day/week/month views. API from Claude Code.
- **Invoice / receipt** per order (like `demo2/invoice-details`): Gracia Fab logo, store
  area (Umuahia North, Abia State) and phone, customer and delivery address, items,
  subtotal, voucher discount, ₦2,500 delivery, total, paid date and Monnify reference.
  Print button. **No tax line** (we don't charge one) and no invented address.
- **Messages** (like `demo2/app-inbox`): the contact-form messages as an inbox.

## Later (stage 4)

Photos library (Cloudinary uploads, reuse across products) and Settings.

## Not doing

Live chat (customers use WhatsApp), KYC, projects, file manager beyond photos,
pricing tables.

## API reference (Claude Code fills this in as endpoints land)

- `GET /api/admin/overview` (live): totals, last7/prev7, last30/prev30, 30-day `daily`
  series, `statusCounts`, recent orders, stock alerts. Full shape at the top of
  `server/services/adminOverview.js`. Days are Lagos days. When the earlier period is 0,
  show "No orders last week" rather than a percentage.
- `PUT /api/admin/orders/status` `{ ids: [...], status: "processing"|"shipped"|"delivered", note? }`
  → `{ updated: [ids], failed: [{ id, message }] }` (live). Same customer email/WhatsApp
  as a single update. Allowed moves: paid → processing → shipped → delivered.
- `GET /api/admin/customers?search=&sort=newest|spent|last-order|name&page=&limit=` (live)
  → `{ customers: [{ _id, name, email, phone, createdAt, ordersCount, paidOrders, totalSpent,
  lastOrderAt, loyaltyPoints, loyaltyTier }], total, page, pages }`. Search is name or email.
- `GET /api/admin/customers/:id` (live) → `{ customer: { name, email, phone, latestAddress,
  loyaltyPoints, loyaltyTier, createdAt }, stats: { ordersCount, paidOrders, totalSpent,
  averageOrderValue, firstOrderAt, lastOrderAt }, orders: [... itemsCount], pointsHistory,
  notes: [{ _id, text, author, createdAt }], bookings }`.
- `POST /api/admin/customers/:id/notes` `{ text }` → the note; `DELETE .../notes/:noteId`.
  Notes are staff-only; the customer never sees them.
- `GET /api/admin/bookings/options` (live) → services `[{ id, label }]`, statuses
  (booked, completed, cancelled, no-show), opening hours, default length (60 min).
- `GET /api/admin/bookings?from=&to=&status=&customer=` (ISO date-times with offset,
  e.g. `2026-11-24T00:00:00+01:00`) → bookings sorted by time, each with `serviceLabel`, `endsAt`.
- `POST /api/admin/bookings` `{ customerName, phone, service, startsAt, durationMinutes?, staff?,
  notes?, customer? (account id) }`; `PUT /api/admin/bookings/:id` (any of those + `status`);
  `DELETE /api/admin/bookings/:id` (for mistakes; normally set status `cancelled`).
  **Safety checks** answer 409 with `code`: `"outside-hours"` (not Mon–Sat 8am–6pm) or
  `"clash"` (same staff member already booked; `clashes` lists them). Show the message and
  a **Book anyway** button that resends with `allowOutsideHours: true` / `allowClash: true`.
- Brides' wedding dates from My Vanity are **not** on the calendar yet: waiting for the MD
  to decide whether staff should see them.
