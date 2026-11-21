# MD handover plan (due Thursday 26 Nov 2026)

From the boss (21 Nov): close out all outstanding items, set up the portal for the
MD of Gracia Fab, visit her to install it on her phones and gadgets, advise the
company if a computer is needed, upload stock while teaching her, and close out
the Monnify integration with the COO.

**The portal** is the admin dashboard of the live site (`www.graciafab.com/admin`),
installed as an app. Admin accounts land there after signing in, the logo takes
them there, and the installed app opens straight into it.

## Before the visit

- [ ] **MD account.** The MD registers on www.graciafab.com with the email she'll
  use for the business (she needs that email on her phone: sign-in sends a code).
  Then, from `C:\dev\gracia-fab\server` with `$env:MONGO_URI` set:
  `npm run admin:grant -- her@email --apply` (run without `--apply` first to check).
- [ ] **Vouchers.** Create GLOW05, BEAUTY20, LUXE5K: Admin → Vouchers, or
  `node data/seedVouchers.js --apply` (dry run without `--apply`). The homepage
  advertises BEAUTY20, so this can't wait.
- [ ] **Keep-awake.** GitHub → Actions → "Keep API awake" → Run workflow (it hasn't
  started by itself), or set up UptimeRobot on `/health`.
- [ ] **Stock sheet.** Admin → Inventory → "Download stock sheet" the morning of the
  visit (89 products, all at 0 except the 13 counted). Print it or bring a laptop.
- [ ] **Server crash alerts.** Render logs should show `Error monitoring is on (Sentry)`.

## At the visit (MD)

1. **Install on each device** (Chrome on Android, Safari on iPhone/iPad):
   - Android: open www.graciafab.com in Chrome → menu ⋮ → "Install app" (or "Add to Home screen").
   - iPhone/iPad: open it in **Safari** → Share → "Add to Home Screen".
   - Laptop/desktop: Chrome or Edge → install icon in the address bar.
   - Sign in on each, then open the app from the home-screen icon: it should open the admin dashboard.
2. **Teach the daily jobs:** Overview (stock alerts), Orders (mark shipped/delivered,
   cancel/refund), Inventory (counts), Sales (reports, Export CSV), Vouchers, and
   adding a product with a real photo.
3. **Upload stock together:** count shelf by shelf, type counts into the downloaded
   sheet (or straight into Inventory for small numbers), upload it, check the preview,
   confirm. Products with 1–5 left show as "low stock".
4. **Get her decisions** (they close audit items only she can):
   - Keep or remove: "100% single-donor raw hair", "zero white cast", "AI undertone accuracy guarantee".
   - Delivery times and returns window on the Shipping & Returns page; read the legal pages.
   - A contact email (e.g. hello@graciafab.com via Hostinger or Zoho) and whether to show a street address.
   - Who else needs admin access (staff), if anyone.

## Computer: advice for the company

The portal works on a phone for daily jobs (orders, quick stock changes). For the
first full stock count, adding products with photos and spreadsheets, a **laptop**
saves hours. Any recent Windows laptop or Chromebook with Chrome and 8 GB RAM is
enough; a tablet with a keyboard is the minimum alternative. No special software
is needed: everything runs in the browser.

## Monnify close-out (with the COO)

- [ ] On Render, the live values are set: `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`,
  `MONNIFY_CONTRACT_CODE` from the **live** Monnify dashboard (`MONNIFY_BASE_URL`
  can stay empty: production uses live by default).
- [ ] In Monnify → Developer → Webhook URLs, the transaction completion URL is
  `https://gracia-fab.onrender.com/api/webhooks/monnify`.
- [ ] Settlement bank account on Monnify is the company's.
- [ ] **One real small payment** (the cheapest in-stock item + the flat ₦2,500 delivery;
  a ₦100 test isn't possible because delivery is always added): pay by card or transfer, then check: the order shows Paid in Admin → Orders, stock went down by
  one, the confirmation email arrived. Then cancel and refund it from Admin → Orders
  (the refund itself is sent from the Monnify dashboard).
- [ ] Note who at the company receives Monnify settlement and dispute emails.

## Still open for Claude Code before Thursday

- Stricter website security policy (CSP enforce), tested page by page first.
- Shorter login sessions with silent renewal, after the CSP.
