import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import AdminApp from "./AdminApp.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { initMonitoring } from "../utils/monitoring";
// Listens for the browser's install offer (Android/Chrome) from the very start;
// the dashboard that shows the button loads a moment later.
import "../components/install/InstallApp";

// The admin portal: a separate app at /admin with its own entry, login and
// home-screen icon. None of this code is part of the shop's bundle, and the
// shop's code (cart, AI chat, checkout…) isn't loaded here.
initMonitoring();

// Arrived safely: clear the shop's loop guard (see OpenAdminApp in App.jsx).
try { sessionStorage.removeItem("adminRedirectAt"); } catch { /* private mode */ }

// The site's service worker (scope "/") makes the admin installable as its
// own app. It never serves admin pages from the shop's offline copy (see
// navigateFallbackDenylist in vite.config.js).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AdminApp />
    </AuthProvider>
  </StrictMode>,
);
