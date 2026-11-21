import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FloatingBackHeader from "../components/FloatingBackHeader";
import Footer from "../components/Footer";
import "../styles/About.css";
import SEO from "../components/SEO";
import API_URL from "../config";
import { isOutOfStock } from "../utils/stock";
import { STORE } from "../utils/storeInfo";
import BookingOptions from "../components/BookingOptions";

// Everything on this page comes from the owner (21 Nov 2026): Gracia Fab is a
// Bems Group company, founded in 2024 as a store in Umuahia North, now
// selling online too. Photos are real products from the catalogue. Don't add
// claims, numbers or services the owner hasn't confirmed.
const PLACEHOLDER = "/product-placeholder.svg";

function About({ onCartOpen }) {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => active && setCatalog(Array.isArray(data) ? data : data.products || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // A real product photo per category: in stock first.
  const photo = useMemo(() => {
    const pick = (cat) => {
      const list = catalog.filter((p) => p.category === cat && p.image);
      return (list.find((p) => !isOutOfStock(p)) || list[0])?.image || PLACEHOLDER;
    };
    return { skincare: pick("skincare"), haircare: pick("haircare"), wig: pick("wig"), bridal: pick("bridal") };
  }, [catalog]);
  const onImgError = (e) => {
    e.currentTarget.src = PLACEHOLDER;
  };

  return (
    <>
      <SEO
        title="About Gracia Fab"
        description="Gracia Fab is a Bems Group beauty store in Umuahia North, Abia State, selling skincare, haircare, hair products and wigs since 2024, with a hair salon, bridal makeup and consultations in store. Now shopping online with nationwide delivery."
        keywords="Gracia Fab, Bems Group, beauty store Umuahia, hair salon Umuahia, wig installation Umuahia, bridal makeup Abia State, skincare Abia State"
        url="/about"
      />

      <FloatingBackHeader backLabel="Back to Home" onCartOpen={onCartOpen} />

      <div className="craft-page" role="main">
        {/* ── 1. Who we are ── */}
        <section className="craft-hero">
          <div className="craft-hero-inner">
            <div className="craft-hero-text">
              <span className="craft-eyebrow">WHO WE ARE</span>
              <h1 className="craft-hero-title">
                Gracia Fab,
                <br />
                <em className="craft-highlight">Umuahia.</em>
              </h1>
              <p className="craft-hero-sub">
                Gracia Fab is a beauty store in Umuahia North, Abia State, and part of
                Bems Group. Since 2024 we&apos;ve bought and sold beauty, skin and hair
                products and a small range of wigs from our shop. Now you can shop
                with us online too, wherever you are in Nigeria.
              </p>
              <div className="craft-metrics-grid">
                <div className="craft-metric-item">
                  <strong>2024</strong>
                  <span>Founded</span>
                </div>
                <div className="craft-metric-item">
                  <strong>Bems Group</strong>
                  <span>Part of the group</span>
                </div>
                <div className="craft-metric-item">
                  <strong>Umuahia</strong>
                  <span>Our shop, Abia State</span>
                </div>
                <div className="craft-metric-item">
                  <strong>Mon–Sat</strong>
                  <span>8am – 6pm</span>
                </div>
              </div>
            </div>

            <div className="craft-hero-media">
              <img src={photo.skincare} alt="Skincare sold at Gracia Fab" className="craft-hero-img" onError={onImgError} />
              <div className="craft-hero-badge">
                <span>In store and online</span>
                <strong>Skin · Hair · Wigs · Bridal</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Our story ── */}
        <section className="craft-difference-split">
          <div className="craft-difference-inner">
            <div className="craft-difference-visual">
              <div className="craft-visual-frame">
                <img src={photo.haircare} alt="Hair products sold at Gracia Fab" className="craft-macro-img" onError={onImgError} />
                <div className="craft-visual-tag">
                  <span>From our shop in Umuahia</span>
                </div>
              </div>
            </div>

            <div className="craft-difference-copy">
              <span className="craft-eyebrow-terracotta">OUR STORY</span>
              <h2 className="craft-diff-title">From a shop in Umuahia to shopping online.</h2>
              <p className="craft-diff-lead">
                Gracia Fab opened in 2024 as a physical beauty store in Umuahia North.
                Customers come in for products, for their hair and for advice.
              </p>
              <p className="craft-diff-body">
                We&apos;re now bringing the same products online, so customers outside
                Umuahia can order from us and have them delivered anywhere in Nigeria.
                Our AI beauty tools help you choose, and the shop is still here when you&apos;d
                rather come in.
              </p>
              <Link to="/products" className="craft-text-link">
                Shop our products →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 3. In the store ── */}
        <section className="craft-pillars-dark">
          <div className="craft-pillars-inner">
            <div className="craft-pillars-left">
              <span className="craft-eyebrow">IN OUR STORE</span>
              <h2 className="craft-pillars-title">
                More than a shop.
                <br />
                <span className="craft-pillars-italic">Visit us in Umuahia.</span>
              </h2>
              <p className="craft-pillars-sub">
                Open {STORE.hours} in Umuahia North, Abia State. Book the salon, bridal
                makeup or a consultation on WhatsApp or by phone.
              </p>
              <BookingOptions />
            </div>

            <div className="craft-pillars-right">
              <div className="craft-pillar-row">
                <span className="craft-pillar-num">✦</span>
                <div className="craft-pillar-content">
                  <h3>Beauty, skin and hair products</h3>
                  <p>Skincare, body care and hair products, plus a small range of wigs, the same ones you can order on this site.</p>
                </div>
              </div>

              <div className="craft-pillar-row">
                <span className="craft-pillar-num">✦</span>
                <div className="craft-pillar-content">
                  <h3>Hair salon</h3>
                  <p>Hairstyles are done in our salon, and our stylists install wigs.</p>
                </div>
              </div>

              <div className="craft-pillar-row">
                <span className="craft-pillar-num">✦</span>
                <div className="craft-pillar-content">
                  <h3>Bridal makeup and accessories</h3>
                  <p>Our staff do bridal makeup, and we sell bridal accessories.</p>
                </div>
              </div>

              <div className="craft-pillar-row">
                <span className="craft-pillar-num">✦</span>
                <div className="craft-pillar-content">
                  <h3>Consultations with our MD</h3>
                  <p>Having trouble with your skin, hair or a wig? Customers in the store can talk it through with the MD.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Shopping online ── */}
        <section className="craft-pillars-dark">
          <div className="craft-pillars-inner">
            <div className="craft-pillars-left">
              <span className="craft-eyebrow">SHOPPING ONLINE</span>
              <h2 className="craft-pillars-title">
                The same store,
                <br />
                <span className="craft-pillars-italic">delivered to you.</span>
              </h2>
            </div>

            <div className="craft-pillars-right">
              <div className="craft-pillar-row">
                <span className="craft-pillar-num">01</span>
                <div className="craft-pillar-content">
                  <h3>Delivery anywhere in Nigeria</h3>
                  <p>A flat ₦2,500, sent from our shop in Umuahia.</p>
                </div>
              </div>
              <div className="craft-pillar-row">
                <span className="craft-pillar-num">02</span>
                <div className="craft-pillar-content">
                  <h3>Secure payment</h3>
                  <p>Pay by card, bank transfer or USSD through Monnify.</p>
                </div>
              </div>
              <div className="craft-pillar-row">
                <span className="craft-pillar-num">03</span>
                <div className="craft-pillar-content">
                  <h3>Help choosing</h3>
                  <p>The AI Beauty Advisor, undertone scan and Routine Generator suggest products from our shelves for your skin and hair.</p>
                </div>
              </div>
              <div className="craft-pillar-row">
                <span className="craft-pillar-num">04</span>
                <div className="craft-pillar-content">
                  <h3>Your own space</h3>
                  <p>Sign in to My Vanity for your beauty profile, picks, orders and reward points.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Wigs and bridal ── */}
        <section className="craft-difference-split">
          <div className="craft-difference-inner">
            <div className="craft-difference-visual">
              <div className="craft-visual-frame">
                <img src={photo.wig} alt="A wig sold at Gracia Fab" className="craft-macro-img" onError={onImgError} />
                <div className="craft-visual-tag">
                  <span>Wigs and installs</span>
                </div>
              </div>
            </div>
            <div className="craft-difference-copy">
              <span className="craft-eyebrow-terracotta">WIGS AND BRIDAL</span>
              <h2 className="craft-diff-title">Buy online, get it done in store.</h2>
              <p className="craft-diff-lead">
                We keep a small range of wigs, and our salon installs wigs in the shop.
              </p>
              <p className="craft-diff-body">
                Getting married? Our staff do bridal makeup in store, and you can add your
                wedding date in My Vanity for a countdown and a bridal beauty timeline.
              </p>
              <Link to="/products?category=wig" className="craft-text-link">
                See our wigs →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6. Help strip ── */}
        <section className="craft-cta-strip">
          <div className="craft-cta-strip-inner">
            <p className="craft-cta-strip-text">Not sure what suits your skin or hair?</p>
            <Link to="/recommend" className="craft-cta-strip-btn">
              Ask the AI Beauty Advisor →
            </Link>
          </div>
        </section>

        {/* ── 7. Final call to action ── */}
        <section className="craft-final-cta">
          <div className="craft-final-cta-inner">
            <h2 className="craft-final-title">
              Shop online,
              <br />
              or come and see us.
            </h2>
            <p className="craft-final-sub">
              Gracia Fab · Umuahia North, Abia State · Open {STORE.hours}
            </p>

            <div className="craft-final-buttons">
              <Link to="/products" className="craft-btn-primary">
                Shop all products →
              </Link>
              <Link to="/contact" className="craft-btn-outline">
                Contact us
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}

export default About;
