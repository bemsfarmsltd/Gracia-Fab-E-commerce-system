# Gracia Fab

AI-powered beauty e-commerce store for the Nigerian market: skincare, haircare, wigs, bridal. Prices are in Naira (NGN).

**Several AI assistants work on this repo at once.** Before editing anything, `git pull --rebase` and read `docs/WORKING_NOW.md`. Claim your task there before you start, and remove your row when you finish.

- Repository: https://github.com/bemsfarmsltd/Gracia-Fab-E-commerce-system (company account, moved 21 Nov 2026). The old `dark-fury22/gracia-fab` is retired once Vercel and Render deploy from the new one.
- `client/`: React 18 + Vite PWA, react-router-dom. Deployed on Vercel.
- `server/`: Node + Express + MongoDB (Mongoose), BullMQ/Redis jobs. ES modules. Deployed on Render.
- AI: Gemini first, Groq fallback. Payments: Monnify (`server/services/monnify.js`). Email: Resend over HTTPS (SMTP is blocked on Render). WhatsApp: Twilio.
- Deeper docs: `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/WORKFLOW.md`, `docs/ROADMAP.md`, `CONTRIBUTING.md`.

## Commands

```bash
cd client && npm run dev      # :5173
cd server && npm run dev      # :5000 (nodemon)
cd server && npm run seed     # reseed products from server/data/products.js
```

Before you call something done, run what CI runs (`.github/workflows/ci.yml`, Node 22 with npm 10):

```bash
cd client && npm run lint && npm test && npm run build
cd server && npm test
```

## Conventions

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`). Branches `feat/…`, `fix/…`, `chore/…` off `main`.
- Release flow: land on `staging` (auto-deploys to staging), verify, then PR `staging` → `main` (auto-deploys to production).
- Server tests use Vitest + Supertest against `server/app.js`, never `server/server.js`, which connects to Mongo and starts workers. Use `mongodb-memory-server` for anything that touches the DB.
- Client tests use Vitest + React Testing Library, in `__tests__/` folders next to the code.
- Server logging uses `server/utils/logger.js` (pino), not `console.*`. The one-off CLI scripts (`setAdmin.js`, `seeder.js`, …) are the exception.
- Request bodies are validated with zod via `middleware/validate.js` and the schemas in `server/validators/`.
- CSS uses the tokens defined in `client/src/index.css`. Never reference an undefined CSS variable; it fails silently and has caused invisible-text bugs before.
- After changing dependencies, check the lockfile with npm 10 (what CI uses): `npx npm@10 ci --dry-run`. npm 11 can write lockfiles that npm 10 rejects; fix with `npx npm@10 install`.
- Env vars are documented in `server/.env.example` and `client/.env.example`. Never commit `.env`.

## Content rules

- **Confirmed facts about the business** (owner, 21 Nov 2026): Gracia Fab is a Bems Group company, founded in 2024 as a physical store in Umuahia North, Umuahia, Abia State, now moving online. It buys and sells beauty, skin and hair products and a small range of wigs. In store: hair salon (hairstyles, wig installs), bridal makeup and accessories, consultations with the MD. Open 8am to 6pm (days not confirmed). The same facts feed the AI assistants (`server/config/ai.js` STORE_FACTS). Don't add others (service prices, delivery times, hair origin, guarantees) without the owner.

- The store is in **Umuahia, Abia State**, not Lagos. Delivery is a flat ₦2,500 nationwide (`server/config/shipping.js`); don't advertise same-day, free-delivery thresholds or voucher codes that don't exist in `server/services/vouchers.js`.
- Don't invent products, brands, reviews or claims. An earlier commit had to strip out fabricated content.
- Product images must show the actual product. Use `/product-placeholder.svg` when there's no real photo; never use generic stock photos as stand-ins. Real photos so far are hosted on Cloudinary (`res.cloudinary.com/dyzkjerez/...`).

## Known gotchas

- Payments are confirmed only by querying Monnify's API (`confirmOrderPayment` in `server/services/orderPayment.js`), never by trusting the browser or the webhook payload. Stock is committed and loyalty points awarded at payment, in `markOrderPaid`, not at order creation.
- Admin image uploads go to Cloudinary (`server/services/imageStorage.js`). Never write uploads to local disk in production: Render's filesystem is wiped on every deploy. Without `CLOUDINARY_URL` the server refuses uploads in production and uses local disk only in development.
- Vouchers (`server/services/vouchers.js`) are checked and priced on the server in `createOrder`; the checkout preview (`/api/vouchers/validate`) is only a preview. The discount comes off items, never delivery, and usage is counted in `markOrderPaid`. The product page shows only codes from `/api/vouchers/public`; never hard-code voucher codes in the UI.
- The site's Content-Security-Policy lives in `client/vercel.json` and is **enforced** (since 21 Nov 2026); blocks are reported to `/api/csp-report` and logged as `CSP violation (blocked)`. When adding any third-party script, iframe, font, API or media host, add it there in the same change, or it will be blocked in production. Don't put third-party scripts in `index.html`; load them where needed with `client/src/utils/loadScript.js`.
- Always cancel orders through `cancelOrder` (`server/services/orderCancel.js`), never by setting `status` directly: it returns stock, frees the voucher, reverses points, records the refund as due and notifies the customer. Refunds are sent in the Monnify dashboard and recorded with `markRefunded`.
- Stock defaults to 0 (out of stock) until counted; counts are entered in the admin Inventory tab or by CSV upload there.
- Keep the working copy outside OneDrive. OneDrive syncing corrupted an earlier `.git`. The canonical local clone is `C:\dev\gracia-fab`.
