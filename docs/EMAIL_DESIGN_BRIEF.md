# Email redesign brief (for Antigravity)

Our user wants the customer emails to look polished and on-brand. Claude Code has
already done the delivery side (plain-text part, sender, subjects); this task is
the look. Claim it in `docs/WORKING_NOW.md` first.

## What to change

- `server/services/emailService.js`: the `emailTemplates` object only (the HTML and
  subject of each email). Don't change `sendEmail`, the function names or their
  arguments; the controllers call them as they are.
- `server/controllers/marketingController.js`: only the HTML wrapper around the
  AI-written marketing email (the `html` string near the "Shop Now" button). Keep
  the unsubscribe link and headers.

Emails: order confirmed, shipped, delivered, cancelled (with and without refund),
refund sent, login code, welcome, marketing.

## Preview without sending

```bash
cd server && npm run email:preview
```

Open `server/email-previews/index.html` (git-ignored). Each email has an HTML
preview and the plain-text version that's sent with it. Check at 360px and 600px wide.

## Email clients are not browsers

- **Table layout with inline styles.** Gmail and Outlook drop `display:flex`, grid,
  `<style>` blocks (partly), CSS variables and most positioning. The current
  templates use flex for item rows; they break in Outlook.
- Max width 600px, centred; must read well on a 360px phone.
- Web-safe fonts with fallbacks (Georgia/serif for headings, Arial/Helvetica for text).
- **Light background** (brand cream `#FBF3E7`, white card, wine `#7A2432` accents;
  see `client/src/index.css`). Avoid all-black emails: they look like spam and
  render badly when the client applies its own dark mode.
- Images only from Cloudinary (`res.cloudinary.com/dyzkjerez/...`), with `alt`,
  `width` and `height`. Never stock photos. The email must make sense with images off.
- Keep each email under about 90 KB of HTML (Gmail clips at 102 KB).

## Keep it out of spam

- No emojis in subject lines (a test checks this). Very few in the body.
- Mostly text, one clear button per email. No image-only emails.
- Links go only to our site: use `${siteUrl()}` (never hard-code a domain, no URL shorteners).
- No ALL CAPS, "FREE!!!", or hype; plain, friendly wording.
- Footer on every email: "Gracia Fab · Umuahia, Abia State, Nigeria", a line on
  why they got the email (e.g. "You're receiving this because you placed an order"),
  and a link to `${siteUrl()}`. Marketing emails keep their unsubscribe link.

## Content rules (from CLAUDE.md)

- Wrap any customer or product text in `escapeHtml(...)` (names, item names).
- Don't invent claims. The current welcome email says "Nigeria's premier AI-powered
  beauty community" and "Exclusive offers for members": drop those unless the
  owner confirms them. Delivery is a flat ₦2,500; don't promise times or free delivery.
- The store is in Umuahia, Abia State (not Lagos). There's no inbox at graciafab.com:
  the cancellation email only says "reply to this email" when `RESEND_REPLY_TO` is
  set. Keep that condition.

## Before you push

```bash
cd server && npm test
```

`tests/emailService.test.js` checks emoji-free subjects, escaping, the plain-text
part and the reply-to wording. Send one real test to yourself afterwards, check
Gmail on a phone and on desktop, then delete your claim row in the same commit.
