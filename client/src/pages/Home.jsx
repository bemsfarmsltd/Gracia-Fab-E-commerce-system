import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import LiveCameraToneDetector from "../components/LiveCameraToneDetector";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/useToast";
import { AFRICAN_UNDERTONES } from "../utils/africanUndertones";
import HeroVideo from "../components/HeroVideo";
import API_URL from "../config";
import { isOutOfStock, stockLabel } from "../utils/stock";
import "../styles/YslHome.css";


// Only what the store actually does today. Claims the owner hasn't confirmed
// (hair origin, sunscreen finish, guarantees) stay out until she does.
const FAQ_ITEMS = [
  {
    q: "How does the AI Beauty Advisor work?",
    a: "Answer a few quick questions about your skin, hair and goals (no account needed) and the Advisor suggests products from our shelves, with a routine to go with them.",
  },
  {
    q: "How does the undertone scan work?",
    a: "It uses your phone or laptop camera, or a photo you choose, to estimate whether your undertone is Warm Golden, Rich Neutral or Deep Espresso. It runs on your device and the photo isn't saved.",
  },
  {
    q: "Can I compare products side by side?",
    a: "Yes. The Compare page puts up to three products next to each other: key ingredients from their descriptions, the skin types they suit, texture and price.",
  },
  {
    q: "Do I need an account to shop?",
    a: "No. You can browse, use the AI tools and fill your bag as a guest. You sign in at checkout, so we can process and track your order.",
  },
  {
    q: "Where do you deliver, and how much does it cost?",
    a: "Anywhere in Nigeria for a flat ₦2,500, sent from our store in Umuahia, Abia State.",
  },
  {
    q: "How can I pay?",
    a: "Checkout is secured by Monnify: card, bank transfer or USSD.",
  },
  {
    q: "What hair are your wigs made from?",
    a: "Each wig's product page describes its hair, length and lace. If you'd like more detail before buying, message us on WhatsApp from the link at the bottom of the page.",
  },
  {
    q: "Is my selfie safe when I use Skin Analysis?",
    a: "Your photo is sent securely to our AI provider for that one analysis. We don't save it.",
  },
];

const PLACEHOLDER = "/product-placeholder.svg";
const CATEGORY_LABELS = { skincare: "Skincare", haircare: "Haircare", wig: "Wigs", bridal: "Bridal" };
const byNewest = (a, b) => String(b.createdAt || b._id).localeCompare(String(a.createdAt || a._id));

function Home({ onCartOpen }) {
  const { addToCart } = useCart();
  const { addToast } = useToast();
  const [openFaq, setOpenFaq] = useState(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  // The real catalogue, so every product, photo and price here is one we sell.
  const [catalog, setCatalog] = useState(null);
  const faqSectionRef = useRef(null);
  const location = useLocation();


  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => active && setCatalog(Array.isArray(data) ? data : data.products || []))
      .catch(() => active && setCatalog([]));
    return () => {
      active = false;
    };
  }, []);

  const store = useMemo(() => {
    const all = (catalog || []).filter((p) => p && p._id && p.name);
    const buyable = all.filter((p) => !isOutOfStock(p)).sort(byNewest);
    const rest = all.filter((p) => isOutOfStock(p)).sort(byNewest);
    const spotlight =
      buyable.find((p) => p.category === "wig") || buyable.find((p) => p.category === "bridal") || buyable[0] || null;
    const newIn = [...buyable.filter((p) => p !== spotlight), ...rest].slice(0, 4);
    const inCategory = (cat) => all.filter((p) => p.category === cat);
    const photoFor = (cat) => {
      const list = inCategory(cat);
      return (list.find((p) => !isOutOfStock(p) && p.image) || list.find((p) => p.image))?.image || PLACEHOLDER;
    };
    const count = (cat) => inCategory(cat).length;
    const skincare = inCategory("skincare").sort((a, b) => Number(isOutOfStock(a)) - Number(isOutOfStock(b)));
    const compare = skincare.filter((p) => (p.suitableFor?.skinType || []).length).slice(0, 2);
    return { loaded: catalog !== null, all, spotlight, newIn, photoFor, count, compare };
  }, [catalog]);

  const handleAddToCart = (product, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!product) return;
    addToCart({
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    addToast(`Added "${product.name}" to your bag 🛍️`, "cart");
    if (onCartOpen) onCartOpen();
  };

  // Let the Navbar's FAQ link ("/#faq") work from any page, and also work
  // when clicked while already on the home page (a route change alone
  // wouldn't remount this component or trigger the browser's native
  // hash-scroll, since the target element didn't exist yet at nav time).
  useEffect(() => {
    if (location.hash === "#faq" && faqSectionRef.current) {
      faqSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);


  return (
    <div className="ysl-home-page">
      <SEO
        title="Gracia Fab — AI-Powered Beauty, Skincare, Haircare, Wigs & Bridal"
        description="Shop Gracia Fab's AI-matched skincare, haircare, wigs and bridal beauty essentials, curated for Nigerian skin, hair and climate."
        keywords="beauty Nigeria, skincare Umuahia, beauty store Abia, haircare products, wigs Nigeria, bridal beauty, AI beauty advisor"
        url="/"
      />

      <Navbar onCartOpen={onCartOpen} transparent />

      <main>
      {/* ── SECTION 1: HERO ── */}
      <section className="ysl-hero-section">
        <div className="ysl-hero-bg">
          <div className="ysl-hero-glow" />
          {/* Still image first, video after the page loads (see HeroVideo). */}
          <HeroVideo className="ysl-hero-video" />
          <div className="ysl-hero-overlay" />
          <div className="ysl-hero-watermark-mask" />
        </div>

        {/* Ambient Floating Golden Stardust (Pizzazz Layer) */}
        <div className="ysl-hero-stardust" aria-hidden="true">
          <span className="stardust star-1">✦</span>
          <span className="stardust star-2">✧</span>
          <span className="stardust star-3">✦</span>
          <span className="stardust star-4">⋆</span>
          <span className="stardust star-5">✧</span>
          <span className="stardust star-6">✦</span>
          <span className="stardust star-7">⋆</span>
        </div>

        <div className="ysl-hero-content">
          <h1 className="ysl-hero-title">
            Beauty, <br />
            <span className="ysl-hero-title-gold">matched to you.</span>
          </h1>
          <p className="ysl-hero-tagline">
            AI-powered skincare, haircare, wigs &amp; bridal beauty for Nigerian skin, hair and climate.
          </p>
          <div className="ysl-hero-actions">
            <div className="ysl-hero-buttons-pair">
              <Link to="/recommend" className="ysl-hero-btn ysl-hero-btn-advisor">
                <span className="ysl-hero-btn-sparkles" aria-hidden="true">
                  <span className="sparkle s1">✦</span>
                  <span className="sparkle s2">✧</span>
                  <span className="sparkle s3">✦</span>
                  <span className="sparkle s4">✧</span>
                </span>
                ✦ Consult AI Advisor <span className="btn-arrow">→</span>
              </Link>
              <Link to="/products" className="ysl-hero-btn ysl-hero-btn-shop ysl-hero-btn-primary">
                Shop The Collection
              </Link>
            </div>
            <button
              type="button"
              className="ysl-hero-pill-scan"
              onClick={() => setCameraModalOpen(true)}
              aria-label="Live Undertone Scan"
            >
              <span className="pill-scan-camera" aria-hidden="true">📸</span>
              <span className="pill-scan-text">Live Undertone Scan · Melanin Match ✦</span>
              <span className="pill-scan-sparkle" aria-hidden="true">✨</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION: LUXURY ASSURANCE & CERTIFICATIONS RIBBON (Phase 1) ── */}
      <div className="ysl-assurance-ribbon" role="region" aria-label="Shopping with Gracia Fab">
        <div className="ysl-ribbon-track">
          <div className="ysl-ribbon-group">
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> SHIPS FROM UMUAHIA, ABIA STATE</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> FLAT ₦2,500 NATIONWIDE DELIVERY</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> MONNIFY SECURED CHECKOUT</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> CARD · TRANSFER · USSD</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> AI BEAUTY ADVISOR</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> EARN POINTS ON EVERY ORDER</span>
          </div>
          <div className="ysl-ribbon-group" aria-hidden="true">
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> SHIPS FROM UMUAHIA, ABIA STATE</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> FLAT ₦2,500 NATIONWIDE DELIVERY</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> MONNIFY SECURED CHECKOUT</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> CARD · TRANSFER · USSD</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> AI BEAUTY ADVISOR</span>
            <span className="ribbon-item"><span className="ribbon-sparkle">✦</span> EARN POINTS ON EVERY ORDER</span>
          </div>
        </div>
      </div>

      {/* ── SECTION: WHAT WE SELL (real product photos from the catalogue) ── */}
      <section className="ysl-campaign-triad-section" aria-label="What Gracia Fab sells">
        <div className="ysl-triad-header">
          <span className="ysl-triad-eyebrow">✦ WHAT WE SELL</span>
          <h2 className="ysl-triad-heading">Skincare, Hair &amp; Bridal Beauty</h2>
          <p className="ysl-triad-sub">
            Products we stock at our store in Umuahia, delivered anywhere in Nigeria.
          </p>
        </div>

        <div className="ysl-triad-grid">
          <article className="ysl-triad-card">
            <div className={`triad-card-media ${!store.loaded ? "is-loading" : ""}`}>
              <img
                src={store.photoFor("skincare")}
                alt="Skincare at Gracia Fab"
                loading="lazy"
                className="triad-card-img"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
              />
              <span className="triad-card-badge">SKINCARE</span>
            </div>
            <div className="triad-card-content">
              <h3 className="triad-card-title">Skincare for Nigerian Weather</h3>
              <p className="triad-card-desc">
                Cleansers, serums, body lotions, oils and sunscreens for everyday care in heat, humidity and Harmattan.
              </p>
              <Link to="/products?category=skincare" className="triad-card-link">
                <span>Shop skincare{store.count("skincare") ? ` (${store.count("skincare")})` : ""}</span>
                <span className="triad-arrow">→</span>
              </Link>
            </div>
          </article>
          <article className="ysl-triad-card">
            <div className={`triad-card-media ${!store.loaded ? "is-loading" : ""}`}>
              <img
                src={store.photoFor("wig")}
                alt="Wigs at Gracia Fab"
                loading="lazy"
                className="triad-card-img"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
              />
              <span className="triad-card-badge">HAIR &amp; WIGS</span>
            </div>
            <div className="triad-card-content">
              <h3 className="triad-card-title">Haircare and Wigs</h3>
              <p className="triad-card-desc">
                Haircare for curly, coily and relaxed hair, and ready-to-wear wigs.
              </p>
              <Link to="/products?category=wig" className="triad-card-link">
                <span>Shop wigs{store.count("wig") ? ` (${store.count("wig")})` : ""}</span>
                <span className="triad-arrow">→</span>
              </Link>
            </div>
          </article>
          <article className="ysl-triad-card">
            <div className={`triad-card-media ${!store.loaded ? "is-loading" : ""}`}>
              <img
                src={store.photoFor("bridal")}
                alt="Bridal beauty at Gracia Fab"
                loading="lazy"
                className="triad-card-img"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
              />
              <span className="triad-card-badge">BRIDAL</span>
            </div>
            <div className="triad-card-content">
              <h3 className="triad-card-title">Bridal Beauty</h3>
              <p className="triad-card-desc">
                Bridal skincare and makeup sets for the big day, plus a free wedding countdown in My Vanity.
              </p>
              <Link to="/products?category=bridal" className="triad-card-link">
                <span>Shop bridal{store.count("bridal") ? ` (${store.count("bridal")})` : ""}</span>
                <span className="triad-arrow">→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>


      {/* ── SECTION: NEW IN STORE (newest real products, in stock first) ── */}
      {store.newIn.length > 0 && (
      <section className="ysl-new-store-section" aria-label="New in store and featured product">
        <div className="ysl-new-store-header">
          <div>
            <span className="ysl-new-store-eyebrow">✦ NEW IN STORE</span>
            <h2 className="ysl-new-store-title">
              New in Store <span className="ysl-new-store-star">✦</span>
            </h2>
            <p className="ysl-new-store-sub">Our latest products, in stock first</p>
          </div>
          <Link to="/products" className="ysl-new-store-view-all">
            <span>View all products</span>
            <span className="arrow">→</span>
          </Link>
        </div>

        <div className="ysl-new-store-split">
          <div className="ysl-new-items-grid">
            {store.newIn.map((item) => {
              const out = isOutOfStock(item);
              return (
                <article key={item._id} className="ysl-new-item-card">
                  <Link to={`/products/${item._id}`} className="new-item-media">
                    <img
                      src={item.image || PLACEHOLDER}
                      alt={item.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    />
                  </Link>
                  {!out && (
                    <button
                      type="button"
                      className="new-item-quick-add"
                      onClick={(e) => handleAddToCart(item, e)}
                      aria-label={`Add ${item.name} to bag`}
                    >
                      🛍️
                    </button>
                  )}
                  <div className="new-item-info">
                    <span className="new-item-tag">{item.brand || CATEGORY_LABELS[item.category] || "Gracia Fab"}</span>
                    <h3 className="new-item-name">
                      <Link to={`/products/${item._id}`}>{item.name}</Link>
                    </h3>
                    <div className="new-item-meta">
                      <span className="new-item-rating">{stockLabel(item)}</span>
                      <span className="new-item-price">₦{Number(item.price).toLocaleString()}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {store.spotlight && (
            <article className="ysl-new-spotlight-card">
              <span className="spotlight-top-badge">✦ Featured · {CATEGORY_LABELS[store.spotlight.category] || "In stock"}</span>
              <Link to={`/products/${store.spotlight._id}`} className="spotlight-media-wrap">
                <img
                  src={store.spotlight.image || PLACEHOLDER}
                  alt={store.spotlight.name}
                  loading="lazy"
                  className="spotlight-img"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                />
              </Link>

              <div className="spotlight-content">
                <h3 className="spotlight-title">{store.spotlight.name}</h3>
                {store.spotlight.brand && <p className="spotlight-desc"><strong>{store.spotlight.brand}</strong></p>}
                <p className="spotlight-desc">{store.spotlight.description}</p>

                <div className="spotlight-price-row">
                  <span className="spotlight-price">₦{Number(store.spotlight.price).toLocaleString()}</span>
                  <span className="spotlight-save-pill">{stockLabel(store.spotlight)}</span>
                </div>

                <button
                  type="button"
                  className="spotlight-add-btn"
                  onClick={(e) => handleAddToCart(store.spotlight, e)}
                  aria-label={`Add ${store.spotlight.name} to bag`}
                >
                  <span>Add to Bag</span>
                  <span className="btn-icon">🛍️</span>
                </button>
                <Link to={`/products/${store.spotlight._id}`} className="ysl-new-store-view-all">
                  <span>See product details</span>
                  <span className="arrow">→</span>
                </Link>
              </div>
            </article>
          )}
        </div>
      </section>
      )}

      {/* ── SECTION: PROMOTIONAL EDITORIAL BANNERS & PERKS (Phase 4 Inspiration) ── */}
      <section className="ysl-promo-banners-section" aria-label="Exclusive offers and brand perks">
        <div className="ysl-promo-grid">
          {/* Card 1: Large Featured First-Order Offer */}
          <article className="ysl-promo-card ysl-promo-card-featured">
            <div className="promo-featured-text">
              <span className="promo-eyebrow">✦ ORDERS OVER ₦25,000</span>
              <h3 className="promo-title">
                Save 20% on Orders <br />of ₦25,000+
              </h3>
              <p className="promo-desc">
                Enter the code at checkout on any order of ₦25,000 or more.
              </p>
              <div className="promo-coupon-badge">
                <span className="coupon-label">USE CODE:</span>
                <span className="coupon-code">BEAUTY20</span>
              </div>
              <Link to="/products" className="promo-cta-btn promo-cta-btn-primary">
                <span>Claim 20% Off</span>
                <span className="btn-arrow">→</span>
              </Link>
            </div>
            <div className="promo-featured-media">
              <img
                src={store.spotlight?.image || store.photoFor("skincare")}
                alt={store.spotlight?.name || "Skincare at Gracia Fab"}
                loading="lazy"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
              />
              <div className="promo-media-glow" aria-hidden="true" />
            </div>
          </article>

          {/* Right Column: 2 Stacked Cards */}
          <div className="ysl-promo-col-stacked">
            {/* Card 2: Delivery (flat ₦2,500) */}
            <article className="ysl-promo-card ysl-promo-card-delivery">
              <div className="promo-card-content">
                <span className="promo-eyebrow">✦ NATIONWIDE DELIVERY</span>
                <h3 className="promo-card-heading">Flat ₦2,500 Delivery Nationwide</h3>
                <p className="promo-card-desc">
                  Shipped from our store in Umuahia, Abia State, door-to-door to all 36 states and the FCT.
                </p>
                <Link to="/#faq" className="promo-card-link">
                  <span>View Delivery Coverage</span>
                  <span className="arrow">→</span>
                </Link>
              </div>
              <div className="promo-card-visual" aria-hidden="true">
                <span className="promo-visual-icon">🚚</span>
                <span className="promo-visual-pill">Ships from Umuahia</span>
              </div>
            </article>

            {/* Card 3: the real loyalty points */}
            <article className="ysl-promo-card ysl-promo-card-vip">
              <div className="promo-card-content">
                <span className="promo-eyebrow">✦ GRACIA FAB REWARDS</span>
                <h3 className="promo-card-heading">Earn Points on Every Order</h3>
                <p className="promo-card-desc">
                  Get 1 point for every ₦100 you spend. Every 100 points takes ₦500 off a future order.
                </p>
                <Link to="/my-vanity" className="promo-card-link promo-card-link-gold">
                  <span>See my points</span>
                  <span className="arrow">→</span>
                </Link>
              </div>
              <div className="promo-card-visual" aria-hidden="true">
                <span className="promo-visual-icon">✨</span>
                <span className="promo-visual-pill">100 pts = ₦500</span>
              </div>
            </article>
          </div>
        </div>

        {/* 4-Pillar Perks Strip directly beneath */}
        <div className="ysl-promo-perks-strip" role="region" aria-label="Why shop with us">
          <div className="promo-perk-item">
            <span className="promo-perk-icon" aria-hidden="true">🚚</span>
            <div className="promo-perk-text">
              <strong>Flat ₦2,500 delivery</strong>
              <span>Anywhere in Nigeria, sent from Umuahia</span>
            </div>
          </div>
          <div className="promo-perk-item">
            <span className="promo-perk-icon" aria-hidden="true">🔒</span>
            <div className="promo-perk-text">
              <strong>Secure payment</strong>
              <span>Card, bank transfer or USSD through Monnify</span>
            </div>
          </div>
          <div className="promo-perk-item">
            <span className="promo-perk-icon" aria-hidden="true">📦</span>
            <div className="promo-perk-text">
              <strong>Real photos, live stock</strong>
              <span>See what's in stock before you order</span>
            </div>
          </div>
          <div className="promo-perk-item">
            <span className="promo-perk-icon" aria-hidden="true">💬</span>
            <div className="promo-perk-text">
              <strong>AI beauty help</strong>
              <span>Advisor, undertone scan and chat, any time</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: AFRICAN COMPLEXION & UNDERTONE SHOWCASE ── */}
      <section className="ysl-undertone-showcase-section">
        <div className="ysl-undertone-header">
          <span className="ysl-undertone-eyebrow">✦ MELANIN-FIRST BEAUTY</span>
          <h2 className="ysl-undertone-title">
            Find Your Undertone <em>✦</em>
          </h2>
          <p className="ysl-undertone-desc">
            Knowing your undertone makes choosing skincare and colour easier. These are the three undertones our scan looks for.
          </p>
        </div>

        <div className="ysl-undertone-cards-grid">
          {Object.values(AFRICAN_UNDERTONES).map((tone) => (
            <div key={tone.id} className="ysl-undertone-card">
              <div
                className="ysl-undertone-swatch"
                style={{ backgroundColor: tone.hex }}
              >
                <span className="ysl-undertone-swatch-label">{tone.name}</span>
              </div>
              <div className="ysl-undertone-card-body">
                <h3 className="ysl-undertone-card-title">{tone.name}</h3>
                <p className="ysl-undertone-card-desc">{tone.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="ysl-undertone-cta-banner">
          <div className="ysl-undertone-cta-text">
            <h3>Unsure of your exact undertone?</h3>
            <p>Use your camera or a photo to find yours. It runs on your device and the photo isn't saved.</p>
          </div>
          <button
            type="button"
            className="ysl-undertone-camera-launch-btn"
            onClick={() => setCameraModalOpen(true)}
          >
            📸 Launch Live Undertone Camera ✦
          </button>
        </div>
      </section>


      {/* ── SECTION: SIDE-BY-SIDE FORMULATION COMPARATOR SPOTLIGHT ── */}
      <section className="ysl-comparator-showcase-section">
        <div className="ysl-comparator-inner">
          <div className="ysl-comparator-text-col">
            <span className="ysl-comparator-pill">✦ COMPARE BEFORE YOU BUY</span>
            <h2 className="ysl-comparator-title">
              Compare Products <em>Side-by-Side</em>
            </h2>
            <p className="ysl-comparator-desc">
              Put up to three products next to each other and see their key ingredients, the skin types they suit, texture and price.
            </p>
            <div className="ysl-comparator-perks">
              <div className="perk-item">
                <span className="perk-check">✓</span>
                <span>Key ingredients picked out of each description</span>
              </div>
              <div className="perk-item">
                <span className="perk-check">✓</span>
                <span>Skin suitability matching (Oily, Dry, Sensitive, Combination)</span>
              </div>
              <div className="perk-item">
                <span className="perk-check">✓</span>
                <span>Prices side by side, with live stock</span>
              </div>
            </div>
            <Link to="/compare" className="ysl-comparator-btn">
              Compare products ⇄
            </Link>
          </div>

          {store.compare.length === 2 && (
            <div className="ysl-comparator-preview-col">
              <div className="comparator-mini-table" aria-label="Example comparison of two products we stock">
                <div className="mini-table-header">
                  <div className="mini-col-head">Example</div>
                  {store.compare.map((p) => (
                    <div key={p._id} className="mini-col-head">{p.name}</div>
                  ))}
                </div>
                <div className="mini-table-row">
                  <span className="mini-label">Brand</span>
                  {store.compare.map((p) => (
                    <span key={p._id} className="mini-val">{p.brand || "—"}</span>
                  ))}
                </div>
                <div className="mini-table-row">
                  <span className="mini-label">Skin type</span>
                  {store.compare.map((p) => (
                    <span key={p._id} className="mini-val">{(p.suitableFor?.skinType || []).join(", ")}</span>
                  ))}
                </div>
                <div className="mini-table-row">
                  <span className="mini-label">Stock</span>
                  {store.compare.map((p) => (
                    <span key={p._id} className="mini-val">{stockLabel(p)}</span>
                  ))}
                </div>
                <div className="mini-table-row price-row">
                  <span className="mini-label">Price</span>
                  {store.compare.map((p) => (
                    <span key={p._id} className="mini-val">₦{Number(p.price).toLocaleString()}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION: SHOP BY CATEGORY ── */}
      <section className="ysl-shopcat-section">
        <div className="ysl-shopcat-heading-strip">
          <h2 className="ysl-shopcat-title">
            Shop by<br />Category
          </h2>
        </div>

        <div className="ysl-shopcat-grid-wrap">
          <div className="ysl-shopcat-grid">
            <div className="ysl-shopcat-col offset">
              <Link to="/products?category=skincare" className="ysl-shopcat-card">
                <div className={`ysl-shopcat-img-wrap ${!store.loaded ? "is-loading" : ""}`} style={{ aspectRatio: "3 / 4" }}>
                  <img
                    src={store.photoFor("skincare")}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    alt="Skincare"
                  />
                </div>
                <span className="ysl-shopcat-label">Skincare</span>
              </Link>

              <Link to="/products?category=wig" className="ysl-shopcat-card">
                <div className={`ysl-shopcat-img-wrap ${!store.loaded ? "is-loading" : ""}`} style={{ aspectRatio: "3 / 4.2" }}>
                  <img
                    src={store.photoFor("wig")}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    alt="Wigs"
                  />
                </div>
                <span className="ysl-shopcat-label">Wigs</span>
              </Link>
            </div>

            <div className="ysl-shopcat-col">
              <Link to="/products?category=haircare" className="ysl-shopcat-card">
                <div className={`ysl-shopcat-img-wrap ${!store.loaded ? "is-loading" : ""}`} style={{ aspectRatio: "4 / 3.3" }}>
                  <img
                    src={store.photoFor("haircare")}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    alt="Haircare"
                  />
                </div>
                <span className="ysl-shopcat-label">Haircare</span>
              </Link>

              <Link to="/products?category=bridal" className="ysl-shopcat-card">
                <div className={`ysl-shopcat-img-wrap ${!store.loaded ? "is-loading" : ""}`} style={{ aspectRatio: "4 / 3.6" }}>
                  <img
                    src={store.photoFor("bridal")}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    alt="Bridal"
                  />
                </div>
                <span className="ysl-shopcat-label">Bridal</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: OUR COMMITMENT ── */}
      <section className="ysl-commitment-section">
        <span className="ysl-commitment-sparkle" aria-hidden="true">✦</span>
        <div className="ysl-commitment-watermark" aria-hidden="true">GRACIA FAB</div>

        <div className="ysl-commitment-content">
          <h2 className="ysl-commitment-title">Shopping with Gracia Fab</h2>
          <p className="ysl-commitment-sub">
            A beauty store in Umuahia, Abia State, selling skincare, haircare, wigs and bridal beauty.
            <br />
            Order online and we deliver anywhere in Nigeria.
          </p>

          <div className="ysl-commitment-badges">
            <div className="ysl-commitment-badge">
              <span className="ysl-commitment-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span className="ysl-commitment-label">Real Product Photos</span>
            </div>

            <div className="ysl-commitment-badge">
              <span className="ysl-commitment-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 19c9-1 13-6 14-14-9 0-14 5-15 13v1z" />
                  <path d="M5 19c3.5-3.5 7-7 12-12" />
                </svg>
              </span>
              <span className="ysl-commitment-label">Live Stock</span>
            </div>

            <div className="ysl-commitment-badge">
              <span className="ysl-commitment-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12M6 21h12M7 3c0 5 3 7 5 8-2 1-5 3-5 8M17 3c0 5-3 7-5 8 2 1 5 3 5 8" />
                </svg>
              </span>
              <span className="ysl-commitment-label">Delivered Nationwide</span>
            </div>
          </div>

          <div className="ysl-commitment-about-prompt">
            <Link to="/about" className="ysl-commitment-about-link">
              <span>Read our story &amp; visit our store</span>
              <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION: VISIT OUR STORE ── */}
      <section className="ysl-store-section" aria-label="Visit our store in Umuahia">
        <div className="ysl-store-inner">
          <div className="ysl-store-header">
            <span className="ysl-store-eyebrow">✦ PHYSICAL STORE &amp; SALON</span>
            <h2 className="ysl-store-title">Visit Our Store in Umuahia</h2>
            <p className="ysl-store-sub">
              A Bems Group company, founded in 2024. Located in Umuahia North, Abia State. Open 8:00 AM – 6:00 PM.
            </p>
          </div>

          <div className="ysl-store-grid">
            <div className="ysl-store-card">
              <span className="store-card-icon" aria-hidden="true">✨</span>
              <h3 className="store-card-heading">Beauty &amp; Skincare</h3>
              <p className="store-card-text">
                Browse our curated skincare, haircare, body care and ready-to-wear wigs in person.
              </p>
            </div>

            <div className="ysl-store-card">
              <span className="store-card-icon" aria-hidden="true">💇‍♀️</span>
              <h3 className="store-card-heading">Hair Salon</h3>
              <p className="store-card-text">
                Professional hairstyles and wig installs by experienced in-house stylists.
              </p>
            </div>

            <div className="ysl-store-card">
              <span className="store-card-icon" aria-hidden="true">👰</span>
              <h3 className="store-card-heading">Bridal Beauty</h3>
              <p className="store-card-text">
                Bridal beauty preparation, wedding makeup sessions and bridal accessories.
              </p>
            </div>

            <div className="ysl-store-card">
              <span className="store-card-icon" aria-hidden="true">💬</span>
              <h3 className="store-card-heading">Consultations</h3>
              <p className="store-card-text">
                Personalized beauty consultations and routine guidance directly with our MD.
              </p>
            </div>
          </div>

          <div className="ysl-store-cta-row">
            <Link to="/about" className="ysl-store-btn ysl-store-btn-primary">
              <span>Read About Gracia Fab</span>
              <span className="arrow">→</span>
            </Link>
            <Link to="/contact" className="ysl-store-btn ysl-store-btn-secondary">
              <span>Contact &amp; Location Details</span>
              <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION: FAQ ── */}
      <section className="ysl-faq-section" id="faq" ref={faqSectionRef}>
        <div className="ysl-faq-inner">
          <h2 className="ysl-faq-title">Frequently Asked Questions</h2>
          <p className="ysl-faq-sub">Everything you need to know before you shop.</p>

          <div className="ysl-faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={item.q} className={`ysl-faq-item ${openFaq === i ? "open" : ""}`}>
                <button
                  type="button"
                  className="ysl-faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                  <span className="ysl-faq-icon" aria-hidden="true">
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && <p className="ysl-faq-answer">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      </main>

      <LiveCameraToneDetector
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
      />

      <Footer />
    </div>
  );
}

export default Home;
