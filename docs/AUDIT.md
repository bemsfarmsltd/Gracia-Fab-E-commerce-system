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

- [ ] **Products with no stock value can be paid for, then get flagged out of stock** (`CC`). 17 live products have no `stock` field. The UI shows them as available (it only checks `stock === 0`), `createOrder` skips the check (`product.stock !== undefined && …`), and `markOrderPaid`'s conditional decrement can't match, so every paid order for them gets a "Paid but out of stock" note. Fix: treat a missing value as 0 on the server and client, and extend `stock:zero-uncounted` to set missing values to 0.
- [ ] **Stock counts not entered** (`YOU`, then `CC`). Only 13 of 89 live products are buyable. 12 still carry the invented 50: run `npm run stock:zero-uncounted -- --apply` once real counts are ready, then enter counts in Admin → Inventory.
- [ ] **Advertised discount codes don't work** (`YOU` decides, then `CC` + `AG`). The product page shows vouchers `BEAUTY20`, `GLOW05` and `LUXE5K`, but the server has no coupon support, so customers copy a code they can't use. Either build real vouchers (validation in `createOrder`, admin screen) or remove them from `ProductDetail.jsx`.
- [ ] **Invented products and reviews in the customer dashboard** (`AG`). `client/src/pages/Dashboard.jsx` hard-codes products such as "Purifying Gel Cleanser with Tea Tree", "Gracia Fab Skincare", ₦18,000, "4.8★, 940 reviews", with stock photos (42 Unsplash links). This breaks the content rules in CLAUDE.md. Use real products from the API, or an empty state.
- [ ] **Placeholder contact details** (`YOU` supplies, `AG` updates). WhatsApp and phone use `+234 801 234 5678` (Footer, Contact, Checkout placeholder). Social links point to bare `instagram.com`, `tiktok.com`, `twitter.com` and `youtube.com`.
- [ ] **Confirm Monnify live keys are set on Render** (`YOU`). The webhook is live and rejects unsigned requests correctly, but a real ₦100 test payment hasn't been confirmed.

## P1: trust, legal, SEO

- [ ] **No privacy policy, terms, or shipping and returns pages** (`AG` builds, `YOU` supplies the wording). Customers expect them, and payment providers usually require them. Link them from the footer and checkout.
- [ ] **The domain `graciafab.com` doesn't exist** (`YOU`, then `CX`). The sitemap (`server/routes/sitemapRoutes.js`), `og:url`, structured data and `logo.png` all point to it. Either buy it and connect it to Vercel, or switch those references to the real URL.
- [ ] **`logo.png` is missing** (`AG`). `index.html` references `/logo.png` in structured data, but the file doesn't exist.
- [ ] **Unknown URLs redirect to `/login`** (`AG`). Add a real "Page not found" page (`App.jsx`, catch-all route).
- [ ] **Unverifiable marketing claims** (`YOU`). "100% single-donor raw hair", "AI undertone accuracy guarantee", "zero white cast" and the chatbot's "complimentary Maison packaging above ₦35,000". Keep only what the business can stand behind.
- [ ] **The product page shows 5 stars when there are no ratings** (`AG`). `ProductDetail.jsx` uses `rating || 5`. Show "No reviews yet" instead.
- [ ] **Stock photos where real images are expected** (`AG`). Unsplash images remain in the Home campaign cards, About, Recommend, the product image `onError` fallbacks (ProductCard, Products) and more (about 80 links in total). Editorial images are a judgement call; fallbacks should use `/product-placeholder.svg`.
- [ ] **Admin header still says "Manage your BeautyAI store"** (`AG`). `AdminDashboard.jsx:402`.

## P1: security and reliability

- [ ] **Dependency vulnerabilities: 8 high-severity in production dependencies, all with non-breaking fixes** (`CX`). Client: `vite`, `brace-expansion`, `fast-uri`, `source-map-js`. Server: `body-parser`, `follow-redirects`, `mongoose`, `zod`. Run `npm audit fix` in each folder using npm 10 (CI uses npm 10, and npm 11 rewrites lockfiles), then run every check.
- [ ] **The Vercel site has no security headers apart from HSTS** (`CX`). Add `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` and a Content-Security-Policy via `headers` in `client/vercel.json`. Test it against Monnify's checkout window, Google sign-in, Cloudinary and the fonts.
- [ ] **The API takes about 34 seconds to wake up** (`YOU`). Render's free plan sleeps when idle, so the first visitor after a quiet spell waits. Upgrade the instance, or add an uptime ping (which also gives downtime alerts).
- [ ] **No error monitoring** (`CX`). Add Sentry (or similar) to the client and server, so crashes caught by the ErrorBoundary and 500s are visible.
- [ ] **Admin routes have no tests apart from stock and upload** (`CX`). Cover stats, product create, update and delete, order status changes and user listing.
- [ ] **Staging isn't set up** (`YOU`, `docs/DEPLOYMENT.md`). Everything ships straight to production. A staging service would catch problems like the 11 November build break before customers do.

## P2: performance

- [ ] **The home page loads slowly** (`AG`). It takes 4.2 s to show its main content on desktop and 4.8 s on mobile (under 2.5 s counts as good), and transfers 3.9 MB on a first visit, mostly the hero video. Use a poster image, lazy-load and compress the video (for example with Cloudinary's `q_auto`/`f_auto` options), and serve smaller versions on mobile.
- [ ] **One large JavaScript file** (`CX`). Every page except admin ships in a 541 KB file (162 KB compressed), plus 309 KB of CSS. Lazy-load the heavier pages (the `lazyWithReload` helper already exists): SkinAnalysis, RoutineGenerator, Compare, Recommend, Dashboard, the camera tone detector.
- [ ] **The product photos are heavy** (`AG`). They total 8.3 MB, with several PNGs at 0.4 to 1 MB. Convert them to WebP at about 800 px, aiming for under 100 KB each, or serve them through Cloudinary's resizing.

## P2: accessibility

- [ ] **Text contrast too low** (`AG`). axe flagged 17 elements (WCAG AA, serious) across the home, shop, product, about and login pages: 7 on the home page, 5 on About and 3 on login. Darken the muted text tokens in `index.css` rather than patching each element.

## Upgrade ideas, for later

- **Delivery fee by region** instead of a flat ₦2,500 (Lagos vs. other states), set on the server in `config/shipping.js`.
- **Pay on delivery** for Lagos: a common expectation in Nigerian e-commerce. This is a business decision.
- **Abandoned-cart and back-in-stock emails** using the existing Resend and queue setup.
- **Verified-purchase reviews:** only customers who bought an item can review it, with a "Verified buyer" badge.
- **Order tracking by WhatsApp** at each status change (Twilio is already wired up).
- **Analytics** (Plausible or GA4) to see which products and pages convert.
- **A performance and accessibility budget in CI** (e.g. Lighthouse CI), so speed and contrast don't slip again.
