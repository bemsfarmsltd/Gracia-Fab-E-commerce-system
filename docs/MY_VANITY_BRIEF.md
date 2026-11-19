# My Vanity design brief (for Antigravity)

**My Vanity** is each signed-in customer's private home, the owner's idea: "their
own personal, private beauty universe". Claude Code has built the data, routing and
a plain working page; **this task is to make it beautiful**. Claim it in
`docs/WORKING_NOW.md` first. It can run alongside the responsive polish
(`docs/RESPONSIVE_AUDIT.md`), which touches different files.

## What already works (don't change the behaviour)

- Signing in (email, code or Google) lands on `/my-vanity`, unless the customer was
  heading somewhere (e.g. checkout), in which case they go back there.
- The logo goes to `/my-vanity` when signed in and `/` when signed out
  (`client/src/utils/afterLogin.js`). The account menu and mobile menu have a
  "My Vanity" link.
- Data comes from `GET /api/vanity` (one request). Profile saves go to
  `PUT /api/vanity/profile`; "delete my answers" is `DELETE /api/vanity/profile`.

## Files you own for this task

- `client/src/pages/MyVanity.jsx`: markup and layout. Keep the data flow, the
  handlers (`saveProfile`, `clearProfile`, `addToBag`, the import prompt) and
  the headings/aria labels the tests use (`src/pages/__tests__/MyVanity.test.jsx`).
- `client/src/styles/MyVanity.css`: all of it is yours.
- Desktop nav (`Navbar.jsx`): optionally add a "MY VANITY" link for signed-in
  customers (only the dropdown and mobile menu have it today).

## The sections (in order, as built)

1. **Hero:** "Good morning/afternoon/evening, {first name}" (Nigerian time),
   "Only you can see this page", profile progress bar (n of 5).
2. **Import prompt** (only when the profile is empty and the AI tools left answers
   on this device): asks before saving.
3. **My beauty profile:** summary, or the chip editor (skin type, skin concerns,
   hair type, hair concerns, shopping for, budget, undertone). All optional.
4. **On its way:** active orders with a 4-step tracker (Paid → Being prepared →
   On its way → Delivered), or "Waiting for payment".
5. **Picked for you:** real in-stock products, each with the real reason
   ("Suits dry skin · Targets dark spots & uneven tone"). With no profile it says
   **"New in store"** instead; keep that honesty.
6. **Time to restock?:** skincare/haircare bought 5–13 weeks ago.
7. **My routine:** the latest saved AI recommendation, or links to build one.
8. **My wishlist** and **Recently viewed**.
9. **My rewards:** points, tier, progress to the next tier.
10. **Privacy footer:** "only you can see it", "we save your scan results, not
    your photos", and "Delete my beauty profile answers".

Sections with nothing in them hide themselves (orders, restock, recently viewed),
so design for both a brand-new customer and a busy one.

## Design direction

- Personal and calm: it should feel like their own dressing table, not a shop
  window. Warm cream/wine palette, generous spacing, the display font for headings.
- Phone first. Must look good on all 15 screens in `docs/RESPONSIVE_AUDIT.md`
  (Claude Code will re-run the check). Product rows can become horizontal
  scrollers on phones.
- Keep buttons at least 44px tall; make product cards align (today the
  "Add to bag" buttons sit at uneven heights when names wrap).
- Motion through `MOTION_MAP` in `client/src/utils/motion.js` only.

## Rules

- Tokens from `client/src/index.css` only; no undefined variables.
- Don't invent anything: no fake ratings, badges, counts, "best seller" labels or
  claims. Ratings show only when `numReviews > 0`. Images: the product's own, or
  `/product-placeholder.svg`.
- The loyalty tier benefits on the old rewards page mention "free delivery";
  delivery is always a flat ₦2,500, so don't repeat those benefits here.
- Before pushing: `cd client && npm run lint && npx vitest run && npm run build`.
