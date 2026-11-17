import crypto from "crypto";

// Signed one-click unsubscribe links for marketing emails. The signature
// ties the link to one user, so it works without logging in but can't be
// edited to unsubscribe someone else. Signed with JWT_SECRET (already set
// everywhere); rotating it invalidates old links, which is acceptable.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || "";

export function unsubscribeToken(userId) {
  return crypto
    .createHmac("sha256", secret())
    .update(`unsubscribe:${userId}`)
    .digest("base64url");
}

export function isValidUnsubscribeToken(userId, token) {
  if (!userId || !token || !secret()) return false;
  const expected = Buffer.from(unsubscribeToken(String(userId)));
  const given = Buffer.from(String(token));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// The API's public address (links in emails point straight at the API).
export const apiUrl = () =>
  (process.env.PUBLIC_API_URL || "https://gracia-fab.onrender.com").replace(/\/+$/, "");

export function unsubscribeUrl(userId) {
  return `${apiUrl()}/api/email/unsubscribe?u=${userId}&t=${unsubscribeToken(String(userId))}`;
}

// Headers that make Gmail/Outlook show their own "Unsubscribe" button and
// allow one-click unsubscribing (RFC 8058).
export function unsubscribeHeaders(userId) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(userId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
