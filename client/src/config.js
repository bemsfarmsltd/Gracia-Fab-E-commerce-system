const isProdBuild = import.meta.env.PROD && import.meta.env.MODE !== "test";
const rawApiUrl = import.meta.env.VITE_API_URL;
const API_URL =
  rawApiUrl !== undefined && rawApiUrl !== ""
    ? rawApiUrl.replace(/\/+$/, "")
    : isProdBuild
      ? "https://api.graciafab.com"
      : "http://localhost:5000";
export default API_URL;

// The public website's address, for canonical links and structured data.
// Set VITE_SITE_URL on Hostinger/Vercel (e.g. https://www.graciafab.com).
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  (isProdBuild ? "https://www.graciafab.com" : "https://gracia-fab.vercel.app")
).replace(/\/+$/, "");
