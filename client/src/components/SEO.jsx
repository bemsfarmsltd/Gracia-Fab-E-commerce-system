import { Helmet } from "react-helmet-async";
import { SITE_URL } from "../config";

function SEO({ title, description, keywords, image, url, type = "website", schema }) {
  const siteName = "Gracia Fab";
  const defaultDesc =
    "Gracia Fab is a beauty store in Umuahia, Abia State, selling skincare, hair products, wigs and bridal beauty, now online with delivery across Nigeria for ₦2,500. Our AI tools help you choose.";
  // The brand logo until real photos of the shop are available (the old
  // default was a frame from an AI-generated video).
  const defaultImage = `${SITE_URL}/logo.png`;
  // VITE_SITE_URL on Vercel (see config.js).
  const baseUrl = SITE_URL;

  const fullTitle = title
    ? `${title} | ${siteName}`
    : `${siteName} — AI-Powered Beauty Advisor`;
  const metaDesc = description || defaultDesc;
  const metaImage = image || defaultImage;
  const metaUrl = url ? `${baseUrl}${url}` : baseUrl;

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content="Gracia Fab" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={metaUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_NG" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:site" content="@graciafab" />

      {/* Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#FE938C" />

      {/* Geo - Nigeria targeting */}
      <meta name="geo.region" content="NG" />
      <meta name="geo.country" content="Nigeria" />

      {/* Structured Data (JSON-LD) */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}

export default SEO;
