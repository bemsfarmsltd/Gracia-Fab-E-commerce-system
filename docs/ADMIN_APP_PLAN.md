# Separate admin app and inventory management (plan, 27 Nov 2026)

The boss asked for (1) the admin portal moved off the customer website, for security and so the MD can open it directly, and (2) the admin to grow into an inventory management system. Also (3) a still picture instead of the video in the home hero on phones.

## 1. Separate admin app: `admin.graciafab.com`

**What changes**

| Today | After |
|---|---|
| Admin lives at `graciafab.com/admin`, inside the customer website | Its own address, `admin.graciafab.com`, its own build |
| Admin code downloads with the shop (lazy-loaded, but it's there to read) | The shop contains no admin code at all; `/admin` on the shop forwards to the new address |
| MD opens the shop, logs in, then goes to the dashboard | MD opens "Gracia Fab Admin" from her home screen (its own installable app and icon), straight to the dashboard |

**What actually protects it** (moving the address alone doesn't stop attackers; the server is what does):

- Already in place: every admin API call needs a logged-in admin account (checked on the server), login needs a code sent by email, rate limits on login.
- New:
  - the API accepts admin calls only from `admin.graciafab.com`
  - the admin site isn't listed on Google (noindex)
  - it gets a strict security policy of its own
  - admin sessions are shorter (8 hours, not 30 days)
  - an activity log of who changed stock, prices and orders, and when
  - optional: an extra Hostinger password in front of the whole admin site

**Who does what**

- Claude Code: second build (`client/admin.html`, its own entry and app manifest), shop forwarding, API origin rule, shorter admin sessions, activity log, Hostinger build settings.
- Antigravity: the admin login screen and home-screen icon in the admin look.
- Needs from the boss or Henry: create the subdomain `admin.graciafab.com` in Hostinger, pointing at the same GitHub repo (build command and output folder will be given).

Size: about 2 days. The shop and admin keep working the whole time; the old `/admin` forwards once the new address is live.

## 2. Inventory management

The admin already has the base of one: products with stock counts, CSV stock upload, low-stock list, stock taken off automatically when an online order is paid and put back on cancellation. What it lacks:

| Phase | Adds | Why it matters |
|---|---|---|
| A. Stock history | Every change recorded: received, sold online, sold in store, damaged/expired, counted; who and when | Today a stock number changes with no trail; mistakes and losses can't be traced |
| B. Receiving stock and suppliers | "Stock in" from a supplier with cost price; supplier list; reorder level per product | Profit per product, and knowing what to reorder and from whom |
| C. In-store sales | A simple till screen on the MD's phone: pick products, take payment (cash/transfer/POS), stock comes off | If the shop and the website sell from the same shelf, in-store sales must be recorded or the website will sell items that are already gone |
| D. Stock take | Count mode on a phone, optionally scanning barcodes with the camera | Faster counting, fewer typing mistakes |

Recommended order: A → C → B → D. Each phase is about 2–4 days (Claude Code: data and APIs; Antigravity: screens).

**Questions for the boss before starting:**

1. Do the physical shop and the website sell from the **same stock**? If yes, in-store sales (phase C) are needed early.
2. Should staff other than the MD use it, and should they see everything (e.g. cost prices, profit)? This decides whether we need staff roles.
3. Do products have **barcodes**?
4. Do you track **cost price** and suppliers today (on paper, Excel)?

## 3. Home hero: still picture on phones

On phones the hero shows a still frame taken from the hero video itself, cropped to phone shape by Cloudinary, so it's the same model, light, wine background and gold accents as the video, with nothing new invented. Phones then download about 60 KB instead of about 0.5 MB of video (mobile data is expensive), and the hero appears at once. Desktop keeps the video.

Recommended frame: 2 s (facing the camera, hands in her twists, full wine background, no bars). Alternative: 1 s (smiling, applying skincare). Candidate frames: from `https://res.cloudinary.com/dyzkjerez/video/upload/so_<seconds>,c_fill,g_auto,ar_9:16,w_828,q_auto,f_auto/v1789284554/Generate_a_high_end_glossy_c_1_arwzb5.jpg`.

Antigravity: build it in `HeroVideo.jsx` / `Home.jsx` (`<picture>` or a `matchMedia` switch at 768 px; keep the headline readable over her, probably bottom gradient). Claude Code: checks phones download no video and the hero still passes contrast.
