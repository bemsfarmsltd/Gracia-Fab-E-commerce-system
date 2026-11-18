// The public website's address, used in links the server sends out (emails,
// WhatsApp, the sitemap). Set FRONTEND_URL on Render; when the store moves to
// graciafab.com, change it there and nothing else on the server.
export const DEFAULT_SITE_URL = "https://gracia-fab.vercel.app";

export const siteUrl = () =>
  (process.env.FRONTEND_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

// "graciafab.com" style, for plain-text mentions.
export const siteHost = () => siteUrl().replace(/^https?:\/\//, "");
