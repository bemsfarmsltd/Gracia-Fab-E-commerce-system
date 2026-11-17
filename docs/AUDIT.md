# Gracia Fab audit — 17 November 2026

A shared, prioritized task list for every assistant on this repo (Claude Code, Antigravity, Codex). Claim an item in `docs/WORKING_NOW.md` before starting it, and tick it here in the same commit as the fix.

**How this was checked:** CI checks run locally, `npm audit` on production dependencies, live checks against the production API (`gracia-fab.onrender.com`) and site (`gracia-fab.vercel.app`), a code and content scan, and an axe accessibility and performance pass in headless Chrome over five live pages at desktop and mobile sizes.

## Overall

The store is functional and in good shape technically:
- Lint is clean, the 85 client and 62 server tests pass, and the build succeeds.
- The live site runs the latest code: Monnify checkout, Inventory tab, error boundary and motion.
- The API sends the main security headers.
- There are no JavaScript errors on the pages tested, and no horizontal scrolling on mobile.

What's left is mostly **data, content and trust** (things a customer would notice), plus some **performance** work.

**Who:** `CC` = Claude Code (server, payments, data, scripts, tests); `AG` = Antigravity (visual, styling, responsive, content UI); `CX` = Codex (refactors, tooling, tests, config); `YOU` = needs a decision or information from the project owner.

## P0: fix before taking real orders

- [x] **Products with no stock value were shown as buyable but refused at checkout** (`CC`, fixed 17 Nov). 17 live products have no `stock` field. The shop API (lean query) returned them without one, so the site showed them as available, while checkout (Mongoose default 0) refused them with "only has 0 left". (Correction: the audit first said they could be paid for and then flagged. In fact they were refused at checkout.) Fixed: one `isOutOfStock()` check on the client, an explicit "missing means 0" on the server, and `stock:zero-uncounted` now also sets missing values to 0. The product page's hard-coded "Only 14 left in Lagos Hub" now shows the real count.
- [ ] **Stock counts not entered** (`YOU`, then `CC`). Only 13 of 89 live products are buyable. 12 still carry the invented 50: run `npm run stock:zero-uncounted -- --apply` once real counts are ready (it also sets the 17 products with no value to 0), then enter counts in Admin → Inventory. The 12 products at 50 were all added through the admin dashboard, so the script leaves them alone; set their real counts in Inventory.
- [x] **Advertised discount codes didn't work** (`CC`, built 17 Nov; owner chose to keep them). Vouchers are now real: a `Voucher` model, server-side validation and pricing in `createOrder` (the discount comes off items, never delivery), a checkout code box, usage counted on payment, and an Admin → Vouchers tab. The product page now loads its voucher strip from `GET /api/vouchers/public`, so it can only advertise live codes. **To switch them on in production:** `node data/seedVouchers.js --apply` (creates GLOW05, BEAUTY20 and LUXE5K with the terms the page advertised), or create them in Admin → Vouchers. Until then the product page shows no vouchers.
- [x] **Invented products and reviews in the customer dashboard** (`AG`). `client/src/pages/Dashboard.jsx` hard-codes products such as "Purifying Gel Cleanser with Tea Tree", "Gracia Fab Skincare", ₦18,000, "4.8★, 940 reviews", with stock photos (42 Unsplash links). This breaks the content rules in CLAUDE.md. Use real products from the API, or an empty state. — Fixed: replaced with authentic Gracia Fab catalog products, real Cloudinary images, and /product-placeholder.svg fallbacks.
- [x] **Placeholder contact details** (`CC`, fixed 17 Nov). WhatsApp and phone are now +234 803 744 7068 (owner-confirmed) in the footer and contact page; the social links are The Bems Group's Instagram and Facebook (TikTok, X and YouTube removed, since Gracia-Fab has no accounts there); the structured data `sameAs` matches.
- [x] **Bouncing contact email and non-real store address removed** (`CC`, 17 Nov). `hello@graciafab.com` (the domain doesn't exist) is gone from the footer and contact page, and the "Visit our store: Victoria Island, Lagos" card is removed: the owner confirmed the address isn't real. Structured data now says only `addressCountry: NG`. Customers reach the store by WhatsApp/phone or the contact form (saved to Admin → Messages). LinkedIn skipped (owner's call).
- [ ] **Add a working contact email when one exists** (`YOU`). Then put it back in `Footer.jsx` and `Contact.jsx`.
- [ ] **Confirm Monnify live keys are set on Render** (`YOU`). The webhook is live and rejects unsigned requests correctly, but a real ₦100 test payment hasn't been confirmed.

## P1: trust, legal, SEO

- [ ] **No privacy policy, terms, or shipping and returns pages** (`AG` builds, `YOU` supplies the wording). Customers expect them, and payment providers usually require them. Link them from the footer and checkout.
- [ ] **The domain `graciafab.com` doesn't exist** (`YOU`, then `CX`). The sitemap (`server/routes/sitemapRoutes.js`), `og:url`, structured data and `logo.png` all point to it. Either buy it and connect it to Vercel, or switch those references to the real URL.
- [x] **`logo.png` is missing** (`AG`). `index.html` references `/logo.png` in structured data, but the file doesn't exist. — Fixed: added branded logo.png in client/public/.
- [x] **Unknown URLs redirect to `/login`** (`AG`). Add a real "Page not found" page (`App.jsx`, catch-all route). — Fixed: created NotFound.jsx & NotFound.css and wired to catch-all route.
- [ ] **Unverifiable marketing claims** (`YOU`). "100% single-donor raw hair", "AI undertone accuracy guarantee", "zero white cast" and the chatbot's "complimentary Maison packaging above ₦35,000". Keep only what the business can stand behind.
- [ ] **The product page shows 5 stars when there are no ratings** (`AG`). `ProductDetail.jsx` uses `rating || 5`. Show "No reviews yet" instead.
- [ ] **Stock photos where real images are expected** (`AG`). Unsplash images remain in the Home campaign cards, About, Recommend, the product image `onError` fallbacks (ProductCard, Products) and more (about 80 links in total). Editorial images are a judgement call; fallbacks should use `/product-placeholder.svg`.
- [ ] **Admin header still says "Manage your BeautyAI store"** (`AG`). `AdminDashboard.jsx:402`.

## P1: security and reliability

- [x] **The search box blocked shoppers after a few pauses** (found by `AG`, fixed by `CC` 17 Nov). Autocomplete (`GET /api/search/suggestions`, a plain database lookup) shared the 5-per-minute AI limit, so the 6th pause in a minute got a 429. Suggestions now have their own 60/min limit; the 5/min cap applies only to the AI searches (POST). Covered by a production-limits test.

- [x] **Dependency vulnerabilities: all 8 high-severity fixed** (`CC`, 17 Nov, redone fresh from main after Codex ran out; its unfinished attempt is on `codex/wip-dependency-audit`). `npm audit fix` with npm 10 in both apps, no breaking upgrades. Server: 0 vulnerabilities. Client: 0 high; 4 moderate remain, see the next item. Lint, 95 client and 73 server tests and the build all pass, and both lockfiles pass `npm ci` on npm 10.
- [ ] **4 moderate client advisories via `vite-plugin-pwa` (build-time only)** (`CC`, P2). `glob`/`minimatch` inside `workbox-build`, used only while building, never shipped to browsers. The fix is a major upgrade to `vite-plugin-pwa@1.x`; do it on its own and re-test the offline/update behaviour.
- [x] **Website security headers** (`CC`, 17 Nov). `client/vercel.json` now enforces `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` and `Permissions-Policy` (camera only for the store itself). The Content-Security-Policy ships in **Report-Only** mode, with reports sent to `POST /api/csp-report` (logged on Render). A local browser test with the exact headers found 0 violations across home, shop, product, about, login, 404 and checkout, including Monnify's payment window. Google sign-in couldn't be tested locally (no client ID).
- [ ] **Switch the CSP to enforce** (`CC`, after about a week). Check Render logs for `CSP violation (report-only)`, add any legitimate sources, then rename the header to `Content-Security-Policy` in `client/vercel.json`.
- [ ] **The API takes about 34 seconds to wake up** (`YOU`). Render's free plan sleeps when idle, so the first visitor after a quiet spell waits. Upgrade the instance, or add an uptime ping (which also gives downtime alerts).
- [ ] **No error monitoring** (`CX`). Add Sentry (or similar) to the client and server, so crashes caught by the ErrorBoundary and 500s are visible.
- [ ] **Admin routes have no tests apart from stock and upload** (`CX`). Cover stats, product create, update and delete, order status changes and user listing.
- [ ] **Staging isn't set up** (`YOU`, `docs/DEPLOYMENT.md`). Everything ships straight to production. A staging service would catch problems like the 11 November build break before customers do.

## P2: performance

- [x] **Home page loads slowly** (`CC`, 17 Nov). The hero showed a 3.3 MB MP4 straight away. Now `HeroVideo` shows a 32 KB still of the first frame at once and starts the video only after page load (with a 1.5 s deadline): a Cloudinary-resized 1.25 MB at 1280 px on wider screens and 0.54 MB at 720 px on phones. Data saver or reduced motion get just the still. Measured on the production build over a throttled ~1.6 Mbps connection: largest-paint 0.66 s on desktop and 1.5 s on mobile (live site before: 4.2 s and 4.8 s), page weight before the video about 610 KB.
- [x] **One large JavaScript file** (`CC`, 17 Nov). 15 pages now load on demand via `lazyWithReload`; only home, shop, product, cart, login and 404 ship up front. Main JS went from 540 to 335 KB (161 to 106 KB compressed) and main CSS from 312 to 181 KB. Monnify's SDK left `index.html` and loads only on checkout. The unused Facebook SDK (placeholder app ID, never initialised, tracked every visitor) was removed. The PWA no longer pre-downloads product photos and the logo on install (4.5 MB down to 1.2 MB); product and Cloudinary images are cached when viewed instead. The products-API cache rule's wrong host is fixed.
- [x] **Product photos heavy** (`CC`, 17 Nov). Re-encoded all 59 at max 800 px, keeping the same filenames and extensions (no catalog or database change): 8.3 MB down to 2.8 MB (−66%). Four were really AVIF saved as `.jpg` (they don't display on older iPhones and Android browsers) and are now real JPEGs. Visually checked against the originals; every file decodes and matches its extension.

## P2: accessibility

- [x] **Text contrast too low** (`AG`) — fixed. Darkened `--text-muted` (`#52362F`) and `--text-faint` (`#6E4F45`) in `index.css` for light theme (giving 9.7:1 and 6.7:1 contrast on ivory backgrounds) and lightened dark theme tokens (`#B4C0D4`, `#8A9BB5`) so all elements pass WCAG AA.

## Upgrade ideas, for later

- **Delivery fee by region** instead of a flat ₦2,500 (Lagos vs. other states), set on the server in `config/shipping.js`.
- **Pay on delivery** for Lagos: a common expectation in Nigerian e-commerce. This is a business decision.
- **Abandoned-cart and back-in-stock emails** using the existing Resend and queue setup.
- **Verified-purchase reviews:** only customers who bought an item can review it, with a "Verified buyer" badge.
- **Order tracking by WhatsApp** at each status change (Twilio is already wired up).
- **Analytics** (Plausible or GA4) to see which products and pages convert.
- **A performance and accessibility budget in CI** (e.g. Lighthouse CI), so speed and contrast don't slip again.
