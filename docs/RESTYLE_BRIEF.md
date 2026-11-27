# Restyle brief: admin and inventory screens (for Antigravity)

From Claude Code, 27 Nov 2026. The screens below work (APIs, tests, permissions) but were built plain on purpose. **Your job is the look and the phone experience**, not the behaviour. Work top to bottom; each section is one commit you can finish and push on its own.

## Before you start

1. `git pull --rebase`. Claim **one section at a time** in `docs/WORKING_NOW.md` (just its files), push the claim, then start.
2. When done with a section: `cd client && npm run lint && npx vitest run && npm run build` all pass, then remove your claim in the same commit, pull and push.
3. Check every screen at **390 × 844** (phone) and **1366 × 900** (laptop): no sideways scrolling, nothing cut off, tap targets at least 44 × 44 px.

## Look and feel (use these, nothing new)

| What | Value |
|---|---|
| Background / cards | `var(--bg)` cream, `var(--surface)` white, `var(--surface-2)` soft cream |
| Primary colour | `var(--accent)` wine `#7A2432`, hover `var(--accent-hover)` |
| Gold accent | `#D4AF37` for rings, rules and icons only. **Text in gold must be `#8A6A1F`** (plain gold fails contrast on white) |
| Text | `var(--text)`, secondary `var(--text-muted)` |
| Status | `var(--success)` / `var(--success-bg)`, `var(--warning)` / `var(--warning-bg)`, `var(--error)` / `var(--error-bg)` |
| Headings | `var(--font-display)` (Playfair Display); body `var(--font-body)` (DM Sans) |
| Radius / shadow | `var(--radius-md)`, `var(--radius-lg)`, `var(--shadow-sm)`, `var(--shadow-md)` |

The reference for "finished" is the **guided tour card** (`client/src/components/tour/Tour.css`) and your **admin sign-in** (`client/src/admin/AdminLogin.css`): wine-to-gold top rule, Playfair title, small uppercase eyebrow in dark gold, pill buttons. Make the admin screens feel like those.

Rules (each has caused a real bug here before):
- Never use a CSS variable that isn't defined in `client/src/index.css`: it fails silently (invisible text).
- Never put white text on a light background or black text on wine. Check contrast is at least 4.5:1.
- Don't invent content (no fake numbers, reviews or claims) in empty states. Say what's true: "No sales yet today."

## Do not change

- Any `data-tour="…"` attribute (the guided tours point at them).
- Anything in `server/`, any `fetch(...)` call, request body or permission check (`can(...)`, `canSeeTab(...)`).
- Test files: they must keep passing. If you rename a visible label, tell Claude Code in `WORKING_NOW.md` so the test can be updated.

## Sections, in order

### 1. Till (`components/admin/AdminTill.jsx`, `AdminTill.css`)
Used standing at the counter on a phone, often one-handed.
- Phone layout order: **search + 📷 Scan** at the top (sticky), product results, then the sale, then the totals and payment buttons in a **sticky bottom bar** with the total and "Complete sale".
- Product results as cards: name (2 lines max), price in wine, stock as a small pill ("3 in stock" / "Out of stock" greyed).
- Payment method buttons: large, three across, the chosen one filled wine.
- After a sale, the **receipt opens as a sheet/modal** on phones (not below the fold), with Print / Send on WhatsApp / New sale.
- The receipt paper keeps its plain black-on-white print look (it prints at 80 mm).
- Done when: a sale can be rung up on a 390 px phone without scrolling to find the total or the Complete button.

### 2. Stock Take (`components/admin/AdminStockTake.jsx`, `AdminStockTake.css`)
Used walking along the shelves with a phone.
- Make **📷 Scan items** the dominant button. Make the last-scan line big and obvious: product name and count, with a gold flash when it changes.
- The counted list as rows with the − / number / + controls at least 44 px; differences as coloured pills (missing = error colours, extra = success colours, "matches" = muted).
- The owner's result card: missing and extra as two big numbers, then the checkbox and Approve.
- Done when: counting 10 items on a phone needs no zooming or precise tapping.

### 3. Suppliers & Costs (`components/admin/AdminSuppliers.jsx`, `AdminSuppliers.css`)
Used by the MD on a laptop and her phone.
- Tabs as a segmented control; on phones they scroll sideways inside their own row (the page itself must not scroll sideways).
- **Costs & margins**: summary as 3 stat cards (stock value at cost, at selling price, products missing a cost). On phones, show each product as a card (name, price, cost input, margin pill, supplier select, reorder input) instead of the wide table.
- Margin pill colours: below 15% warning, 15 to 35% neutral, above 35% success.
- **Profit**: the four totals as stat cards; the "missing cost" warning as a warning banner.
- Done when: the MD can enter a cost and see the margin change on a phone.

### 4. Barcode Labels (`components/admin/AdminLabels.jsx`, `AdminLabels.css`)
- Controls in a tidy toolbar; the table as cards on phones.
- **Don't touch** the `.label-sheet` / `.label` print rules (sizes are millimetre-exact for A4 sticker sheets) except colours of the on-screen preview.

### 5. Staff (`components/admin/AdminStaff.jsx`)
- Owner and staff as person cards (initial avatar, name, email, role pill, status "Active" / "Invite sent"); Add staff as a small form card at the top.
- "What staff can do" as a neat list with check icons.

### 6. Products and permissions (`components/admin/AdminProducts.jsx`, `AdminOrders.jsx`, `AdminOrderBoard.jsx`)
- Show each product's **shop code** (`sku`) and barcode in the product card/list and the edit form (read-only text; changing a barcode is done in Barcode Labels).
- Hide buttons staff can't use (they currently get a "not allowed" message): use `can(user, "...")` from `client/src/utils/portal.js` (`user` is already passed to the dashboard):
  - `products.edit`: add / edit / delete / photo
  - `orders.cancel`: cancel and refund
  - `customers.export`: CSV exports, note delete
  - `messages.delete`: message delete

### 7. Activity Log and Stock History: built by Claude Code (27 Nov)
No longer yours to build. Both exist and are styled in the admin look, in `components/admin/AdminActivity.jsx`, `AdminStockHistory.jsx` and `AdminLogs.css`, plus a History button in `InventoryPanel.jsx`. Refine them if you like, keeping their behaviour and tests (`__tests__/AdminLogs.test.jsx`).

## When you finish a section

Add one line under "Open questions" in `WORKING_NOW.md`: "For Claude Code: <section> restyled; screens checked at 390 and 1366." Claude Code will run the browser checks (contrast, phone layout, tours).
