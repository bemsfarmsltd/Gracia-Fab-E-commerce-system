import express from "express";
import Product from "../models/Product.js";
import logger from "../utils/logger.js";

const router = express.Router();

import { siteUrl } from "../utils/siteUrl.js";

export { siteUrl };

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/products", priority: "0.9", changefreq: "daily" },
  { url: "/recommend", priority: "0.8", changefreq: "monthly" },
  { url: "/about", priority: "0.6", changefreq: "monthly" },
  { url: "/contact", priority: "0.5", changefreq: "monthly" },
  { url: "/shipping-returns", priority: "0.4", changefreq: "yearly" },
  { url: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { url: "/terms", priority: "0.3", changefreq: "yearly" },
];

const LANDING_SLUGS = [
  "best-moisturiser-oily-skin-nigeria",
  "best-wig-oval-face-nigeria",
  "bridal-skincare-routine-nigeria",
  "haircare-products-natural-hair-nigeria",
  "skincare-routine-dark-skin-nigeria",
];

// @route GET /sitemap.xml  (the website proxies /sitemap.xml here — see
// client/vercel.json — so search engines find it on the site's own domain)
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({}).select("_id updatedAt").lean();
    const base = siteUrl();

    const pages = [
      ...STATIC_PAGES,
      ...LANDING_SLUGS.map((slug) => ({ url: `/beauty/${slug}`, priority: "0.7", changefreq: "monthly" })),
      ...products.map((p) => ({
        url: `/products/${p._id}`,
        priority: "0.8",
        changefreq: "weekly",
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : null,
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) =>
      `  <url><loc>${base}${p.url}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (error) {
    logger.error({ err: error }, "sitemap error");
    res.status(500).send("Error generating sitemap");
  }
});

export default router;
