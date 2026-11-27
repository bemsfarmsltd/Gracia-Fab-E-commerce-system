import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import process from "node:process";
import { fileURLToPath } from "node:url";

// The public site address: VITE_SITE_URL on Vercel (https://graciafab.com once
// the domain is connected). Fills %SITE_URL% in index.html and writes
// robots.txt, so changing domains needs no code edits.
const DEFAULT_SITE_URL = "https://www.graciafab.com";
const ROBOTS = (site) => `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /checkout
Disallow: /cart
Disallow: /my-orders

Sitemap: ${site}/sitemap.xml
`;

function siteUrlPlugin() {
  let site = DEFAULT_SITE_URL;
  return {
    name: "gracia-site-url",
    configResolved(config) {
      const defaultUrl =
        config.command === "build" && config.mode === "production"
          ? "https://www.graciafab.com"
          : DEFAULT_SITE_URL;
      site = (config.env.VITE_SITE_URL || defaultUrl).replace(/\/+$/, "");
    },
    // %APP_VERSION%: the deployed commit (Vercel sets VERCEL_GIT_COMMIT_SHA at build).
    transformIndexHtml: (html) =>
      html
        .replaceAll("%SITE_URL%", site)
        .replaceAll("%APP_VERSION%", (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7)),
    configureServer(server) {
      server.middlewares.use("/robots.txt", (_req, res) => {
        res.setHeader("Content-Type", "text/plain");
        res.end(ROBOTS(site));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: ROBOTS(site) });
    },
  };
}

// The admin portal is a separate app (admin/index.html). In dev and preview,
// send /admin/<anything> to it instead of the shop (Hostinger does the same
// with client/public/.htaccess).
function adminAppPlugin() {
  const rewrite = (req, _res, next) => {
    const path = (req.url || "").split("?")[0];
    if (/^\/admin(\/|$)/.test(path) && !/\.[a-z0-9]+$/i.test(path)) req.url = "/admin/index.html";
    next();
  };
  return {
    name: "gracia-admin-app",
    configureServer: (server) => { server.middlewares.use(rewrite); },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  // Two apps from one build: the shop (index.html) and the admin portal
  // (admin/index.html → dist/admin/). They share only common libraries.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin/index.html", import.meta.url)),
      },
      output: {
        // Admin-only libraries (barcode drawing, camera scanning) get "admin-"
        // names so the shop's offline cache skips them (globIgnores below).
        manualChunks(id) {
          if (id.includes("node_modules/@zxing/")) return "admin-zxing";
          if (id.includes("node_modules/jsbarcode/")) return "admin-jsbarcode";
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    siteUrlPlugin(),
    adminAppPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Gracia Fab — AI Beauty Advisor",
        short_name: "Gracia Fab",
        description:
          "Your AI-powered beauty advisor for skincare, haircare, wigs and bridal beauty in Nigeria.",
        // Wine bar and cream splash screen, like the site.
        theme_color: "#7A2432",
        background_color: "#FBF3E7",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["shopping", "beauty", "lifestyle"],
        shortcuts: [
          {
            name: "Shop Products",
            url: "/products",
            description: "Browse all beauty products",
          },
          {
            name: "AI Advisor",
            url: "/recommend",
            description: "Get AI beauty recommendations",
          },
        ],
      },
      workbox: {
        // The shop's offline copy must never answer for the admin portal.
        navigateFallbackDenylist: [/^\/admin(\/|$)/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Don't pre-download product photos or the large logo on install:
        // that was ~4.5 MB in the background for every first-time visitor.
        // They're cached when actually viewed (runtimeCaching below).
        // Also skip the crash-alert code (Sentry): it only loads when
        // VITE_SENTRY_DSN is set and isn't needed offline.
        // And never the admin portal: customers' phones shouldn't download it.
        globIgnores: [
          "**/images/products/**", "**/logo.png", "**/assets/sentryLoader-*.js",
          "admin/**", "**/assets/admin-*", "**/assets/AdminDashboard-*", "**/icons/admin-icon*",
        ],
        runtimeCaching: [
          {
            // Product photos shipped with the site (client/public/images/products).
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/images/products/"),
            handler: "CacheFirst",
            options: {
              cacheName: "product-images",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Product and upload images hosted on Cloudinary.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\/image\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cloudinary-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "unsplash-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Match the Hostinger API subdomain and same-origin domain.
            urlPattern:
              /^https:\/\/(api\.graciafab\.com|(www\.)?graciafab\.com)\/api\/products.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-products",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
});
