import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import process from "node:process";

// The public site address: VITE_SITE_URL on Vercel (https://graciafab.com once
// the domain is connected). Fills %SITE_URL% in index.html and writes
// robots.txt, so changing domains needs no code edits.
const DEFAULT_SITE_URL = "https://gracia-fab.vercel.app";
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
      site = (config.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
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

export default defineConfig({
  plugins: [
    react(),
    siteUrlPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Gracia Fab — AI Beauty Advisor",
        short_name: "Gracia Fab",
        description:
          "Your AI-powered beauty advisor for skincare, haircare, wigs and bridal beauty in Nigeria.",
        theme_color: "#FCA311",
        background_color: "#000000",
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Don't pre-download product photos or the large logo on install:
        // that was ~4.5 MB in the background for every first-time visitor.
        // They're cached when actually viewed (runtimeCaching below).
        // Also skip the crash-alert code (Sentry): it only loads when
        // VITE_SENTRY_DSN is set and isn't needed offline.
        globIgnores: ["**/images/products/**", "**/logo.png", "**/assets/sentryLoader-*.js"],
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
            // Was gracia-fab-api.onrender.com, which isn't the real API host,
            // so this rule never matched.
            urlPattern:
              /^https:\/\/gracia-fab(-api)?\.onrender\.com\/api\/products.*/i,
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
