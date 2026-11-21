import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { BeautyProfileProvider } from "./context/BeautyProfileContext.jsx";
import { ToastProvider } from "./components/Toast";
import { initMonitoring } from "./utils/monitoring";

// Crash alerts (only when VITE_SENTRY_DSN is set; loads in the background).
initMonitoring();

// Auto-refresh when a new Service Worker deployment is activated so mobile and
// desktop browsers immediately display the latest version instead of serving stale cache.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    reg.update().catch(() => {});
  });

  // Only reload when a new version replaces one that was already running.
  // On a first visit the worker takes control for the first time; reloading
  // then just flickers the page and jumps the visitor back to the top.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <GoogleOAuthProvider
        clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}
      >
        <AuthProvider>
          <CartProvider>
            <BeautyProfileProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </BeautyProfileProvider>
          </CartProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </HelmetProvider>
  </StrictMode>,
);
