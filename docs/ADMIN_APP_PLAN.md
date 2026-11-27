# Separate admin app and inventory management (plan, 27 Nov 2026)

The boss asked for (1) the admin portal moved off the customer website, for security and so the MD can open it directly, and (2) the admin to grow into an inventory management system. Also (3) a still picture instead of the video in the home hero on phones.

## 1. Separate admin app: done (27 Nov)

The boss didn't want another domain, so the admin stayed at **graciafab.com/admin** but is now a separate app:

- its own build entry (`client/admin/index.html`) and sign-in
- its own installable app, "Gracia Fab Admin"
- not indexed by search engines
- none of its code in the shop

Also done:

- **8-hour admin sessions.** Renewing doesn't extend them, and the server refuses older admin tokens.
- **Activity log.** Every admin change is recorded: who, what, when, and before → after for prices, stock, order status, cancellations and refunds. It's read with `GET /api/admin/activity`.

The Activity screen in the admin is next (Antigravity).

## 2. Inventory management

The admin already has the base of one: products with stock counts, CSV stock upload, low-stock list, stock taken off automatically when an online order is paid and put back on cancellation. What it lacks:

| Phase | Adds | Why it matters |
|---|---|---|
| A. Stock history | Every change recorded: received, sold online, sold in store, damaged/expired, counted; who and when | Today a stock number changes with no trail; mistakes and losses can't be traced |
| B. Receiving stock and suppliers | "Stock in" from a supplier with cost price; supplier list; reorder level per product | Profit per product, and knowing what to reorder and from whom |
| C. In-store sales | A simple till screen on the MD's phone: pick products, take payment (cash/transfer/POS), stock comes off | If the shop and the website sell from the same shelf, in-store sales must be recorded or the website will sell items that are already gone |
| D. Stock take | Count mode on a phone, optionally scanning barcodes with the camera | Faster counting, fewer typing mistakes |

### Decided (27 Nov)

- **The shop and the website sell from the same shelf.** In-store sales must take stock off the same count the website uses, at the moment of sale.
- **Staff get their own portal access.**
- **Barcode generation is part of it.**

### Build order

| Step | What | Who | Size |
|---|---|---|---|
| 1. Staff accounts and roles | MD (owner) adds staff in a Staff screen; staff sign in at /admin with their own email, password and emailed code; each sees only what their role allows; 8-hour sessions and the activity log apply to them too. Two roles to start (table below) | CC: roles, permissions on every API, staff invites. AG: Staff screen, menu that hides what a role can't use | ~2 days |
| 2. Stock history (ledger) | Every stock change is a recorded movement: sold online, sold in store, received, returned, damaged/expired, counted. The product's count is the sum of its movements, so it can always be explained | CC | ~1.5 days |
| 3. In-store till | On a phone or tablet: scan or search products, quantity, payment method (cash, transfer, POS card), optional customer phone. Completing the sale takes stock off immediately (refuses to sell what isn't there), prints a receipt or sends it by WhatsApp. Sales reports combine shop and online | CC: sales API and stock. AG: till screen and receipt | ~3 days |
| 4. Barcodes | Each product gets a code (SKU, e.g. GF-000123) and a printable barcode (Code 128); products that already have a manufacturer barcode keep theirs. Print label sheets (name, price, barcode). Scan with the phone camera in the till and stock-take | CC: codes, label sheet. AG: label layout, scanning screen | ~2 days |
| 5. Stock take | Count mode: scan each item, see the difference from the system count, confirm; differences become "counted" movements in the ledger | CC + AG | ~1.5 days |
| 6. Suppliers and cost prices | Receiving stock from a supplier with cost price; reorder levels; profit per product (MD only) | CC + AG | ~2–3 days |

**Roles (proposed; the boss can adjust):**

| Can… | Owner / MD | Staff |
|---|---|---|
| See and move orders (packing, shipping), Order Board | ✓ | ✓ |
| In-store till (sell), receipts | ✓ | ✓ |
| Bookings, Messages | ✓ | ✓ |
| Count stock, receive deliveries | ✓ | ✓ |
| Add/edit products, change prices, delete | ✓ | ✗ |
| Cancel orders and record refunds | ✓ | ✗ |
| Vouchers, sales reports, cost prices and profit | ✓ | ✗ |
| Customers' contact details and export | ✓ | view only |
| Add/remove staff, activity log | ✓ | ✗ |

**Still to answer:**
- Do you track cost prices and suppliers today? (Needed for step 6 only.)
- Will you print labels on plain A4 sticker sheets, or buy a label printer? (A4 sheets work from day one.)
- In-store payment methods: cash, bank transfer and POS card. Anything else?

## 3. Home hero: still picture on phones

On phones the hero shows a still frame taken from the hero video itself, cropped to phone shape by Cloudinary, so it's the same model, light, wine background and gold accents as the video, with nothing new invented. Phones then download about 60 KB instead of about 0.5 MB of video (mobile data is expensive), and the hero appears at once. Desktop keeps the video.

Recommended frame: 2 s (facing the camera, hands in her twists, full wine background, no bars). Alternative: 1 s (smiling, applying skincare). Candidate frames: from `https://res.cloudinary.com/dyzkjerez/video/upload/so_<seconds>,c_fill,g_auto,ar_9:16,w_828,q_auto,f_auto/v1789284554/Generate_a_high_end_glossy_c_1_arwzb5.jpg`.

Antigravity: build it in `HeroVideo.jsx` / `Home.jsx` (`<picture>` or a `matchMedia` switch at 768 px; keep the headline readable over her, probably bottom gradient). Claude Code: checks phones download no video and the hero still passes contrast.
