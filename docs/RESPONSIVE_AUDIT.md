# Responsive audit (19 Nov)

The owner wants the site to look good on these 15 screens. Claude Code measured every
page at each size; **Antigravity: please take the polish list below** (claim it in
`docs/WORKING_NOW.md` first).

| Phones | Size | Tablets / large | Size |
|---|---|---|---|
| Galaxy A55 | 360 × 800 | iPad Mini | 768 × 1024 |
| iPhone SE | 375 × 667 | Surface Pro 10 | 960 × 1440 |
| iPhone 12 Pro | 390 × 844 | iPad Pro 13 | 1032 × 1376 |
| iPhone 16 | 393 × 852 | Nest Hub Max | 1280 × 800 |
| Pixel 9 / Pixel 10 | 412 × 924 | | |
| Pixel 9 Pro Fold (folded) | 412 × 922 | | |
| Galaxy Z Fold 6 (folded) | 412 × 968 | | |
| Pixel 9 Pro | 427 × 952 | | |
| iPhone 14 Pro Max | 430 × 932 | | |
| iPhone 16 Pro Max | 440 × 956 | | |

## How it was measured

24 pages (20 public, plus account, orders, checkout and admin logged in) × 14 sizes
(Pixel 9 and 10 are identical), in Chrome with reduced motion so scroll reveals
don't skew positions. Each screen is checked for: sideways scrolling, anything cut
off at the screen edge, text under 12px, tap targets under 32px, and fixed bars
covering the screen. Screenshots were reviewed by eye too, since a squashed layout
can still "fit".

The script lives outside the repo (`C:\dev\_browser\responsive.cjs`); ask Claude
Code to re-run it after your changes.

## Already fixed by Claude Code (19 Nov)

- **Shop page ran off the right edge on every phone.** In the one-column phone
  layout, `.glow-catalog-container` kept `align-items: flex-start`, so the catalogue
  shrank to its toolbar's natural width (467px). Now `stretch`.
- **Shop page numbers ran off phones ≤ 393px.** `.pagination-pages-group` now wraps.
- **Account page squeezed into a sliver on all phones.** Its phone layout was
  dropped in `d31cd93` (6 Nov). Restored at the end of `Dashboard.css`: one column,
  and the menu becomes a sideways-scrolling row.
- **Account page showed the owner's name** ("Esther Obisesan") for customers with no
  name. Now "Your name".
- **Beauty guide pages (`/beauty/...`) required login**, so visitors and Google saw a
  sign-in form. They're public now.

**Result after the fixes: 336 of 336 page × screen combinations pass** (no sideways scrolling, nothing cut off at the edge). What remains is visual polish, below.

## Polish list for Antigravity (most important first)

1. **Home: the ☰ menu icon is nearly invisible on phones and iPad.** On the
   transparent header over the dark-red hero, the icon is dark on dark and pushed
   against the right edge (`.ysl-mobile-toggle`, 26 × 21px). Make it light on the
   transparent header, at least 44 × 44px, with breathing room from the edge.
2. **Account page header (all phones):** the logo overlaps the cart and account
   icons (`header.account-topbar`). Screenshots: `dashboard-375x667.png`, `dashboard-412x924.png`.
3. **Product page breadcrumb (phones):** "Home / Products / Skincare / name" overlaps
   itself; separators sit on top of words. Let it wrap or truncate the product name.
4. **Floating back header (product, shop, about…):** "GRACIA FAB" breaks onto two
   lines next to the back button on phones (`header.floating-back-header`). The
   product page also shows two "Back to Products" buttons; keep one.
5. **Home hero on iPad, Surface and Nest Hub:** the tilted 3D panel shows a stray
   white edge on its right side, and on iPad Mini the face is cropped by the panel.
6. **Tap targets under 32px** (aim for 44px on phones):
   - Header "MY CART (0)" button is 16px tall on most pages.
   - Footer Instagram/Facebook icons are 16 × 16px.
   - Shop filters: close ✕ (17 × 28), group headers (28px tall).
   - Product page: "Add to Wishlist", "Compare", "(12 Reviews)" links (18–22px tall).
   - Account page: "Edit"/"Add" buttons (29px), and the email-preference switch hit area (4px wide).
   - Routine generator option chips (30px tall).
   - Compare remove ✕ (26 × 26).
7. **Text under 12px** (10.9–11.8px): badges and eyebrows across Home, Shop cards
   (`.card-brand`, `.badge-sold-out`, price labels), Contact labels, Checkout step
   labels, and the Admin tabs and stat labels (9.6–9.9px, the smallest on the site).
   Small uppercase eyebrows can stay at 11px if letter-spaced; body labels and form
   labels should be at least 12px.
8. **Beauty guide button contrast:** on `/beauty/...` the "Get AI Recommendations" button has dark text on the wine background; make the text light.
9. **Fixed header height:** on iPhone SE and Nest Hub Max (short screens) the
   header takes 13–14% of the screen. Consider a slimmer header when scrolled.

## Rules (from CLAUDE.md)

- Only the colour tokens defined in `client/src/index.css`; never an undefined variable.
- Scroll animations go through `MOTION_MAP` in `client/src/utils/motion.js`.
- Don't change wording or claims while restyling.
- Before pushing: `cd client && npm run lint && npx vitest run && npm run build`.
