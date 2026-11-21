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
- [ ] **Stock counts not entered** (`YOU`). Checked live 20 Nov: only 13 of 89 products are buyable. The invented 50s and missing values are gone (all uncounted products are now 0), so what remains is entering real counts in Admin → Inventory (or the CSV upload there).
- [x] **Advertised discount codes didn't work** (`CC`, built 17 Nov; owner chose to keep them). Vouchers are now real: a `Voucher` model, server-side validation and pricing in `createOrder` (the discount comes off items, never delivery), a checkout code box, usage counted on payment, and an Admin → Vouchers tab. The product page now loads its voucher strip from `GET /api/vouchers/public`, so it can only advertise live codes. **To switch them on in production:** `node data/seedVouchers.js --apply` (creates GLOW05, BEAUTY20 and LUXE5K with the terms the page advertised), or create them in Admin → Vouchers. Until then the product page shows no vouchers.
- [x] **Invented products and reviews in the customer dashboard** (`AG`). `client/src/pages/Dashboard.jsx` hard-codes products such as "Purifying Gel Cleanser with Tea Tree", "Gracia Fab Skincare", ₦18,000, "4.8★, 940 reviews", with stock photos (42 Unsplash links). This breaks the content rules in CLAUDE.md. Use real products from the API, or an empty state. — Fixed: replaced with authentic Gracia Fab catalog products, real Cloudinary images, and /product-placeholder.svg fallbacks.
- [x] **Placeholder contact details** (`CC`, fixed 17 Nov). WhatsApp and phone are now +234 803 744 7068 (owner-confirmed) in the footer and contact page; the social links are The Bems Group's Instagram and Facebook (TikTok, X and YouTube removed, since Gracia-Fab has no accounts there); the structured data `sameAs` matches.
- [x] **Bouncing contact email and non-real store address removed** (`CC`, 17 Nov). `hello@graciafab.com` (the domain doesn't exist) is gone from the footer and contact page, and the "Visit our store: Victoria Island, Lagos" card is removed: the owner confirmed the address isn't real. Structured data now says only `addressCountry: NG`. Customers reach the store by WhatsApp/phone or the contact form (saved to Admin → Messages). LinkedIn skipped (owner's call).
- [ ] **Add a working contact email when one exists** (`YOU`). Then put it back in `Footer.jsx` and `Contact.jsx`.
- [ ] **Confirm Monnify live keys are set on Render** (`YOU`). The webhook is live and rejects unsigned requests correctly, but a real small test payment (cheapest item + ₦2,500 delivery) hasn't been confirmed.

## P1: trust, legal, SEO

- [x] **No privacy policy, terms, or shipping and returns pages** (`AG` builds, `YOU` supplies the wording) — fixed. Built standard PrivacyPolicy.jsx, TermsOfService.jsx, and ShippingReturns.jsx marked with owner-review draft banners (no unverified addresses or claims; accurate ₦2,500 shipping rate and Monnify notices). Linked from footer and checkout with unit tests.
- [x] **The domain `graciafab.com` doesn't exist** (`YOU`, then `CX`). The sitemap (`server/routes/sitemapRoutes.js`), `og:url`, structured data and `logo.png` all point to it. Either buy it and connect it to Vercel, or switch those references to the real URL. Done 17 Nov (CC): references switched to gracia-fab.vercel.app. If a custom domain is bought later, set `FRONTEND_URL` on Render and update robots.txt, index.html and SEO.jsx.
- [x] **`logo.png` is missing** (`AG`). `index.html` references `/logo.png` in structured data, but the file doesn't exist. — Fixed: added branded logo.png in client/public/.
- [x] **Unknown URLs redirect to `/login`** (`AG`). Add a real "Page not found" page (`App.jsx`, catch-all route). — Fixed: created NotFound.jsx & NotFound.css and wired to catch-all route.
- [ ] **Unverifiable marketing claims** (`YOU`). "100% single-donor raw hair", "AI undertone accuracy guarantee", "zero white cast" and the chatbot's "complimentary Maison packaging above ₦35,000". Keep only what the business can stand behind.
- [x] **The product page shows 5 stars when there are no ratings** (`AG`) — fixed. Shows "No reviews yet" when unreviewed, removed hardcoded 5-star fallbacks in `ProductDetail.jsx`, and added unit test.
- [ ] **Stock photos where real images are expected** (`AG`). Unsplash images remain in the Home campaign cards, About, Recommend, the product image `onError` fallbacks (ProductCard, Products) and more (about 80 links in total). Editorial images are a judgement call; fallbacks should use `/product-placeholder.svg`.
- [x] **Admin header still says "Manage your BeautyAI store"** (`AG`) — fixed. Updated to "Manage your Gracia Fab store" in `AdminDashboard.jsx:404`.

## P1: security and reliability

- [x] **The search box blocked shoppers after a few pauses** (found by `AG`, fixed by `CC` 17 Nov). Autocomplete (`GET /api/search/suggestions`, a plain database lookup) shared the 5-per-minute AI limit, so the 6th pause in a minute got a 429. Suggestions now have their own 60/min limit; the 5/min cap applies only to the AI searches (POST). Covered by a production-limits test.

- [x] **Dependency vulnerabilities: all 8 high-severity fixed** (`CC`, 17 Nov, redone fresh from main after Codex ran out; its unfinished attempt is on `codex/wip-dependency-audit`). `npm audit fix` with npm 10 in both apps, no breaking upgrades. Server: 0 vulnerabilities. Client: 0 high; 4 moderate remain, see the next item. Lint, 95 client and 73 server tests and the build all pass, and both lockfiles pass `npm ci` on npm 10.
- [x] **Dependency advisories** (`CC`, fixed 19 Nov). `npm audit` is 0 on client and server. Client: vite-plugin-pwa 1.3 → 2.0, vitest 3 → 5 (2 critical dev-only advisories), and an override giving workbox-build the patched `glob` 14. Server: vitest 3 → 5, and an override giving nodemon the patched `minimatch` 11. Offline mode re-tested in Chrome (worker installs, 50 files cached, pages open offline). Remove the two `overrides` once workbox-build and nodemon ship fixed versions.
- [x] **Website security headers** (`CC`, 17 Nov). `client/vercel.json` now enforces `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` and `Permissions-Policy` (camera only for the store itself). The Content-Security-Policy ships in **Report-Only** mode, with reports sent to `POST /api/csp-report` (logged on Render). A local browser test with the exact headers found 0 violations across home, shop, product, about, login, 404 and checkout, including Monnify's payment window. Google sign-in couldn't be tested locally (no client ID).
- [x] **CSP enforced** (`CC`, 21 Nov). Tested first: 18 public pages on the live site at phone and desktop width with the report-only policy (0 violations; a planted violation was caught, so the check works), and every logged-in page, all 9 admin tabs, checkout and the Monnify payment window locally with the policy enforced (0 violations, 0 errors). Blocks are still reported to `/api/csp-report` (Render logs: `CSP violation (blocked)`). To roll back in an emergency, rename the header in `client/vercel.json` back to `Content-Security-Policy-Report-Only`.
- [x] **The API took about 34 seconds to wake up** (`CC`, 20 Nov). `.github/workflows/keep-awake.yml` pings `/health` every 10 minutes (free; failed runs email a downtime alert). A paid Render instance is still the sturdier fix: GitHub can delay scheduled runs, and one always-on free service uses ~744 of the 750 free hours. See `docs/DEPLOYMENT.md`. **21 Nov: the scheduled job has never run in either repository (0 runs), so the server still sleeps. Use UptimeRobot or cron-job.org on /health every 5–10 minutes instead (owner action).**
- [x] **Crash alerts are on** (`CC` built, owner set the DSNs 20 Nov). Website verified live (test error accepted by Sentry, EU region, Allowed Domains set). Server: confirm `Error monitoring is on (Sentry)` in the Render logs after a restart. Setup notes in `docs/DEPLOYMENT.md`.
- [x] **Admin routes have no tests apart from stock and upload** (`CX`). Cover stats, product create, update and delete, order status changes and user listing. Done 17 Nov (CC), see P2 below.
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

---

# Audit #2 — 17 November 2026 (evening)

**How this was checked:** CI checks, a scan of every file and the full git history for secrets, live checks against the production API and site, a server code review (error handling, input safety, order lifecycle, email, scheduled jobs), a website review (routes, SEO, sitemap, images), and axe and performance passes in Chrome on the live site.

## What's improved since this morning

- **Live speed:** the home page shows its main content in 1.3 s on desktop and 2.3 s on mobile (was 4.2 s and 4.8 s). Main JS is 330 KB (was 540 KB). There are no JS errors on any page tested.
- **Security:** five security headers are live, and the CSP report endpoint answers. **No secrets in the repo or its history**: only `user:password` placeholders, and no `.env` was ever committed.
- **All checks pass:** client lint, 106 client tests and the build; 78 server tests.
- **Legal pages** (`/privacy-policy`, `/terms`, `/shipping-returns`) exist and are linked from the footer and checkout (drafts).

## P0: blocking real sales (mostly owner actions)

- [ ] **No vouchers exist in production** (`YOU`). `GET /api/vouchers/public` returns `[]`, so the product page shows none. Create GLOW05, BEAUTY20 and LUXE5K in Admin → Vouchers.
- Duplicate of **Stock counts not entered** above.
- [x] **Customer emails weren't being delivered** (fixed 19 Nov). graciafab.com is verified in Resend and RESEND_FROM_EMAIL is set on Render; the owner confirmed login codes arrive. Every email now also has a plain-text part and emoji-free subjects (`CC`). The first test landed in Gmail spam: normal for a brand-new domain, see the deliverability item.
- [x] **Redesign the customer emails** (`AG`, done 19 Nov, 0befffb). Checked by CC: table layout, Umuahia footer, escaped names, emoji-free subjects.
- [ ] **Email deliverability: new-domain reputation** (`YOU`, then `CC`). Ask a few people to open the emails and press "Not spam"/move to Inbox; keep volume low for the first weeks (marketing emails are the riskiest). Check Google Postmaster Tools for graciafab.com. After about 2 weeks of clean sending, tighten DMARC from `p=none` to `p=quarantine` in Hostinger DNS.
- Duplicate of **Confirm Monnify live keys are set on Render** above.

## P1: fix soon

- [ ] **MD handover by Thu 26 Nov** (boss, 21 Nov). Plan and checklists: `docs/HANDOVER.md` (MD admin account via `npm run admin:grant`, install on her devices, stock upload session, her decisions on claims/legal/contact, Monnify close-out with the COO).

- [x] **My Vanity v1** (`CC`, 19 Nov). Private home for signed-in customers at `/my-vanity` (`GET /api/vanity`, `PUT|DELETE /api/vanity/profile`): optional beauty profile, picks from real in-stock products with the real reason, orders on their way, restock reminders, saved routine, wishlist, recently viewed, rewards. Sign-in lands there (or back to where the customer was going, e.g. checkout); the logo goes there when signed in. Also fixed: account/login legal links pointed at the homepage.
- [x] **Design My Vanity** (`AG`, done 20 Nov, 96b3593).
- [x] **Loyalty tier benefits promised free delivery** (fixed 20 Nov, owner decision: remove). Every tier now shows the real rule (1 point per ₦100, 100 points = ₦500 off); the unimplemented "% back", priority support, early access and VIP perks were removed too. Add tier perks back only when checkout/support actually applies them.
- [x] **Bridal countdown in My Vanity** (`CC`, 20 Nov, owner asked for it). Optional wedding date in the beauty profile; countdown plus milestones from the site's bridal guide (start routine 8 weeks before, makeup trial 4 weeks, no new products 2 weeks); bridal products and "For your wedding" picks within 12 weeks; hides after the date.

- [x] **Responsive polish on 15 target screens** (`AG`, done 20 Nov, 87cb5f0). Brief: `docs/RESPONSIVE_AUDIT.md`.

- [x] **Moved the site to www.graciafab.com** (live 19 Nov, checked by CC). The main address is **www.graciafab.com** (graciafab.com redirects there). VITE_SITE_URL on Vercel and FRONTEND_URL on Render are both https://www.graciafab.com; VITE_API_URL stays https://gracia-fab.onrender.com. Checked live: canonical/og links, robots.txt, sitemap and CORS. Resend verified graciafab.com on 19 Nov (DKIM, SPF and DMARC records checked publicly). Set RESEND_FROM_EMAIL on Render; optional RESEND_REPLY_TO for a real inbox (graciafab.com has no MX, so it can send but not receive).
- [x] **Compare page said "In Stock" for everything** (`CC`, fixed 18 Nov). It now shows the real stock text, won't add out-of-stock products (Add All skips them), and shows "No reviews yet" instead of a made-up "★ 4.8 (12)".

- [x] **Store location said Lagos everywhere** (`CC`, fixed 17 Nov). The store is in **Umuahia, Abia State** (owner-confirmed). The wording is fixed site-wide, and the Contact page and footer show the town (no street address yet). Lagos same-day/24h promises and "free delivery over ₦50,000/₦35,000" were removed (the server always charges a flat ₦2,500), and the home page's non-existent MAISON20 code was replaced by BEAUTY20. Don't reintroduce Lagos as the store's location.

- [x] **Paid orders can now be cancelled and refunded** (`CC`, 17 Nov). Choosing "Cancelled" in Admin → Orders (or `PUT /api/admin/orders/:id/cancel`) asks for a reason and cancels any order that hasn't shipped. For a paid order it returns exactly the stock payment took (`stockCommitted`, recorded by `markOrderPaid`; older orders get all items back), frees the voucher use, reverses the loyalty points and records a refund of the order total as **due**. The customer gets an email and WhatsApp. After sending the refund in the Monnify dashboard, the admin clicks **Mark refunded** with Monnify's reference (`PUT /api/admin/orders/:id/refund`) and the customer is told. Cancelling is atomic, so a double click can't return stock twice. Shipped orders are refused ("handle it as a return"). My Orders shows the refund status. Also fixed: admin status notes were silently stripped by the validator, and status-menu failures were silent.
- [x] **Google can't find a sitemap** (`CC`). `robots.txt` and the sitemap use `graciafab.com`, which doesn't exist, and the sitemap lives on the API server while `/sitemap.xml` on the website returns the app. Build URLs from `FRONTEND_URL` and serve `/sitemap.xml` on the website (Vercel rewrite to the API). Done 17 Nov (CC): `/sitemap.xml` on the website is rewritten to the API, which builds URLs from `FRONTEND_URL`.
- [x] **Shop and product pages have no SEO data** (`AG`) — fixed. Added category-aware `<SEO>` to `Products.jsx`, and per-product `<SEO>` with Product structured data (Schema.org JSON-LD with NGN pricing, stock availability, and aggregate reviews) to `ProductDetail.jsx`, covered by unit test.
- [x] **Marketing emails have no unsubscribe link** (`CC`). The weekly job (`marketingController.sendMarketingEmails`) sends without one. Add a signed one-click unsubscribe link and an `unsubscribe` endpoint that sets `emailPreferences`, as expected by email providers and Nigeria's NDPA. Done 17 Nov (CC): signed link in the footer plus List-Unsubscribe headers; `/api/email/unsubscribe`; the account-page switch now saves.
- [x] **Raw internal errors sent to customers** (`CC`). 47 handlers across 11 controllers return `error.message` (for example Mongoose or database messages). Return a generic message in production and log the details. Done 17 Nov (CC): `utils/httpErrors.js` `sendServerError()` in 43 handlers, and the error middleware hides 5xx text in production. Details are logged.
- [x] **Remaining low-contrast text** (`AG`) — fixed. Darkened `.craft-eyebrow-terracotta` and `.craft-cta-strip` background to `#8E3B14` on About (>6:1 contrast), updated `.pdp-brand-eyebrow` to `#7A5418` (6.5:1 on ivory, `#E5B842` on dark mode), and added `#1A0609` solid dark fallback background to `.ysl-hero-section`, `.ysl-hero-bg`, and `.ysl-hero-video` for guaranteed white navbar contrast.
- [ ] **Legal pages are drafts** (`YOU`). Review and confirm the wording (returns window, delivery times, data handling) before relying on them.

## P2: hardening and housekeeping

- [x] **Unpaid orders pile up** (`CC`). Pending orders are never cleaned up. Auto-cancel unpaid orders after 48 hours (stock isn't held, so it's just tidying admin and reports). Done 17 Nov (CC): `services/orderCleanup.js` runs hourly from `server.js`. If a payment was started, it asks Monnify first and marks the order paid if the customer did pay; it sends no message to the customer.
- [x] **Logins shortened to 7 days with silent renewal** (`CC`, 21 Nov). Tokens last 7 days (`server/utils/generateToken.js`); the website renews them through `POST /api/auth/refresh` once a day while in use, clears expired sessions on load, and signs out if renewal is refused (e.g. after a password change). Renewal also picks up account changes such as a new admin role. Also fixed: a first visit no longer reloads the page when offline mode installs.
- [x] **CORS allows `localhost` in production** (`CC`). Only add the localhost origins when `NODE_ENV !== "production"`. Done 17 Nov (CC): needs `NODE_ENV=production` on Render, which also turns on the generic 500 messages.
- Duplicate of **The API takes about 34 seconds to wake up** above.
- [x] **Admin route tests** (`CC`). Stats, product CRUD, order status and the user list are still untested (stock, vouchers and uploads are covered). Done 17 Nov (CC): `tests/admin.test.js`. This also found that the user list sent login-code hashes to the browser; now fixed.
- [x] **37 stock-photo links remain** (`AG`/`YOU`) — fixed image-error fallbacks in ProductCard, CartDrawer, Checkout, Products, RoutineStepCard, SkinToneDetector, and SkinAnalysis to `/product-placeholder.svg`. Remaining editorial stock photos (Home, About, Recommend, Hero) to be replaced when original brand imagery is provided (`YOU`).

## Upgrade ideas (product)

- **Order tracking page:** a status timeline with WhatsApp updates at each step (Twilio is already wired up).
- **Delivery fee by state**, instead of a flat ₦2,500.
- **Pay on delivery for Lagos.**
- **Abandoned-cart and back-in-stock emails** (once email delivery is fixed).
- **Review requests** after delivery, with a "Verified buyer" badge.
- ~~**Admin:** low-stock alerts, sales by product and month, order CSV export.~~ Done 17 Nov (CC): Sales tab, Inventory low-stock filter and alert, Overview stock alerts, and Export CSV on Orders and Sales.
- **Let customers spend loyalty points at checkout**, so earned points turn into repeat sales.
- **Proper product variants** (shade, wig length, size), each with its own stock and price.
- **Bridal bundles:** a curated set at a bundle price, priced on the server like vouchers.
- **Privacy-friendly analytics** (e.g. Plausible) to see which products and pages convert.
