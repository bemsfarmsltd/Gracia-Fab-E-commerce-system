const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export default API_URL;

// The public website's address, for canonical links and structured data.
// Set VITE_SITE_URL on Vercel (e.g. https://graciafab.com) once the domain is
// connected. Same default as vite.config.js, which fills index.html and
// robots.txt from the same variable.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://gracia-fab.vercel.app").replace(/\/+$/, "");
