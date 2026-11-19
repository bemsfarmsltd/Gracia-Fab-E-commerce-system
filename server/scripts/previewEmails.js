// Writes every email template to server/email-previews/ (git-ignored) as
// .html plus the plain-text part as .txt, with an index page, so templates
// can be checked in a browser without sending anything.
//   cd server && npm run email:preview
// Then open server/email-previews/index.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emailTemplates } from "../services/emailService.js";
import { htmlToText } from "../utils/htmlToText.js";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "email-previews");
fs.mkdirSync(out, { recursive: true });

const items = [{ name: "Glow Serum", quantity: 2, price: 18500 }, { name: "Shea Body Butter", quantity: 1, price: 9000 }];
const samples = {
  orderConfirmed: () => emailTemplates.orderConfirmed("Adaeze", "A1B2C3", 48500, items),
  orderShipped: () => emailTemplates.orderShipped("Adaeze", "A1B2C3"),
  orderCancelled: () => emailTemplates.orderCancelled("Adaeze", "A1B2C3", 48500),
  orderCancelledUnpaid: () => emailTemplates.orderCancelled("Adaeze", "A1B2C3", 0),
  refundSent: () => emailTemplates.refundSent("Adaeze", "A1B2C3", 48500),
  orderDelivered: () => emailTemplates.orderDelivered("Adaeze"),
  loginOtp: () => emailTemplates.loginOtp("Adaeze", "482913"),
  welcome: () => emailTemplates.welcome("Adaeze"),
};

const rows = [];
for (const [key, make] of Object.entries(samples)) {
  if (!emailTemplates[key.replace(/Unpaid$/, "")]) continue;
  const { subject, html } = make();
  fs.writeFileSync(path.join(out, `${key}.html`), `<!doctype html><meta charset="utf-8"><title>${subject}</title>${html}`);
  fs.writeFileSync(path.join(out, `${key}.txt`), `Subject: ${subject}\n\n${htmlToText(html)}\n`);
  rows.push(`<li><a href="${key}.html">${key}</a> · <a href="${key}.txt">text</a> — ${subject}</li>`);
}
fs.writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><h1>Gracia Fab emails</h1><ul>${rows.join("")}</ul>
<p>The marketing email is written by AI at send time (server/controllers/marketingController.js), so it isn't previewed here.</p>`,
);
console.log(`Wrote ${rows.length} previews to ${out}`);
