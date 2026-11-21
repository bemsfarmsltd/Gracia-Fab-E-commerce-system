# "Shop by Category" images (for Antigravity, using Gemini)

The owner doesn't like the current "Shop by Category" tiles on the homepage (real
product packshots: they don't match the site's look). She asked for **new images made
with Gemini** for the four tiles: **Skincare, Haircare, Wigs, Bridal**. Claim it in
`docs/WORKING_NOW.md` first.

## What to make

- Four images in **one consistent style**, matching the site: warm cream and wine
  (`--bg` #FBF3E7, `--accent` #7A2432 in `client/src/index.css`), soft natural light,
  calm and editorial. Portrait ratio to suit the tiles (about 3:4 / 4:3 as in the grid).
- **Category mood, not fake products:**
  - Skincare: unbranded jars, droppers and textures (creams, oils) on a cream surface.
  - Haircare: unbranded bottles, combs, silk scarf, natural hair texture.
  - Wigs: a styled wig on a stand or hair texture close-up, no face needed.
  - Bridal: makeup brushes, a veil or bridal accessories, soft flowers.
- **No text, logos, brand names or readable labels** on anything (Gemini tends to add
  fake labels; regenerate if it does). Nothing that looks like a specific real product.
- If people appear: Black Nigerian women, natural and respectful, not presented as
  Gracia Fab customers or staff. Products-only scenes are preferred.

## Where it goes

- Upload the final images to Cloudinary (the store's account, `res.cloudinary.com/dyzkjerez/...`),
  or `client/public/images/categories/` if Cloudinary isn't available to you, as WebP,
  about 900px wide, under 150 KB each.
- In `client/src/pages/Home.jsx`, the Shop by Category tiles currently use
  `store.photoFor("<category>")`. Replace those four `src` values with the new images
  (keep `loading="lazy"`, keep the `onError` fallback to `/product-placeholder.svg`).
  Leave the rest of the homepage on real product photos.
- Alt text describes the scene plainly ("Skincare jars and droppers on a cream surface").

## Rules

- This is an owner decision (21 Nov 2026) for **category tiles only**: decorative
  category art. Product cards, product pages, "New in Store" and the featured product
  keep the real product photos (CLAUDE.md content rules).
- Check the 15 screens in `docs/RESPONSIVE_AUDIT.md`; keep `Home.test.jsx` passing
  (it checks there are no Unsplash images).
- Before pushing: `cd client && npm run lint && npx vitest run && npm run build`.
