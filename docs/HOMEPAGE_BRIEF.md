# Homepage redesign brief (for Antigravity)

The owner said the homepage doesn't show Gracia Fab's real products or what the
business does. Claude Code has done the content pass (21 Nov); **this task is the
visual redesign around the real content.** Claim it in `docs/WORKING_NOW.md` first.

## What changed (content, already live)

Everything on the homepage now comes from the real catalogue (`GET /api/products`),
through the `store` object in `client/src/pages/Home.jsx`:

- `store.newIn`: the 4 newest products, in-stock first (real photo, brand, price, stock label).
- `store.spotlight`: one real in-stock product (a wig if one is in stock, else bridal, else newest).
- `store.photoFor(category)`: a real product photo for each category tile and card.
- `store.count(category)`: product counts per category.
- `store.compare`: two real skincare products for the compare preview.

Removed because they were invented: the 5 hard-coded "New in Store" products (with
fake ratings and a fake ₦125,000 → ₦98,000 discount), the "Gracia Privé Club", the
"14-Day Purity Guarantee", "100% single-donor raw hair", "zero white cast", "AI
undertone accuracy guarantee", the foundation shade names (the shop doesn't sell
foundation), and every Unsplash photo. Don't bring any of these back.

## Rules

- **Images:** only real product photos from the catalogue (`product.image`), or
  photos the owner provides of the shop, the MD and real products. No stock photos,
  no AI-generated models. Fallback: `/product-placeholder.svg`.
- **Product photos are packshots** (white or plain backgrounds, mixed shapes). Show
  them with `object-fit: contain` on a light surface, not `cover`; today the cards
  crop them (e.g. the serum in the Skincare card).
- **No invented numbers:** no ratings, review counts, "bestseller" badges, discounts
  or stock counts that don't come from the data. Ratings stay off until real reviews exist.
- **Copy:** keep it factual. Gracia Fab is a beauty store in Umuahia, Abia State,
  selling skincare, haircare, wigs and bridal beauty, delivering nationwide for a flat
  ₦2,500, paid through Monnify. More about the business is coming from the MD.
- Sections that depend on data must look good while loading (the catalogue comes from
  the API) and must hide cleanly if there's nothing to show (the code already hides
  "New in Store" when the catalogue is empty).
- Tokens from `client/src/index.css`; motion through `MOTION_MAP`.
- Check all 15 screens in `docs/RESPONSIVE_AUDIT.md`. Tests: `src/pages/__tests__/Home.test.jsx`
  checks real products, no invented claims and no Unsplash photos; keep it passing.

## Open items that need the owner (don't design placeholders that look real)

- **Hero:** the background video is AI-generated ("Generate a high-end glossy…").
  Replace it with a real photo or short video of the shop/products when the owner
  sends one; until then a product-led hero (real products on a plain background) is
  better than a model who isn't a Gracia Fab customer.
- **About Gracia Fab (facts now confirmed, 21 Nov):** please add a short "Visit our
  store" section: a Bems Group company, founded 2024, store in Umuahia North, Abia
  State, open 8am to 6pm; in store: beauty, skin and hair products, a hair salon
  (hairstyles and wig installs), bridal makeup and accessories, and consultations with
  the MD. Link to /about (rewritten with these facts) and /contact. No street address
  or days of the week yet.
