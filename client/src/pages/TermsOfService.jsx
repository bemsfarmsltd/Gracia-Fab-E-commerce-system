import { Link } from "react-router-dom";
import FloatingBackHeader from "../components/FloatingBackHeader";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import "../styles/Legal.css";

function TermsOfService({ onCartOpen }) {
  return (
    <>
      <SEO
        title="Terms of Service"
        description="Review Gracia Fab's terms of service covering orders, pricing in Naira, payment verification, product authenticity, and store policies."
        url="/terms"
      />
      <FloatingBackHeader backLabel="Back to Store" onCartOpen={onCartOpen} />

      <main className="legal-page">
        <div className="legal-container">
          {/* Owner Review Notice */}
          <div className="legal-draft-banner" role="alert">
            <span className="legal-draft-icon" aria-hidden="true">📋</span>
            <div className="legal-draft-text">
              <strong>Draft for Store Owner Review</strong>
              This standard terms of service document is prepared as a draft for Gracia Fab. Before public reliance or formal adoption, please review with your legal advisor to confirm specifics with your corporate entity and operational policies.
            </div>
          </div>

          <header className="legal-header">
            <span className="legal-eyebrow">Store Policies &amp; Agreement</span>
            <h1 className="legal-title">Terms of Service</h1>
            <div className="legal-meta">
              <span>Effective Date: November 2026</span>
              <span>Status: Draft for Owner Review</span>
              <span>Jurisdiction: Federal Republic of Nigeria</span>
            </div>
          </header>

          <article className="legal-content">
            <section className="legal-section">
              <h2>1. Agreement to Terms</h2>
              <p>
                Welcome to Gracia Fab. By accessing or using our website, AI beauty advisor, catalog, or purchasing items through our store, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use our platform.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. Product Catalog, Pricing &amp; Availability</h2>
              <p>
                Gracia Fab offers curated beauty products, skincare formulations, haircare essentials, wigs, and bridal beauty items.
              </p>
              <ul>
                <li>
                  <strong>Pricing:</strong> All prices are displayed and payable in <strong>Nigerian Naira (₦)</strong>. Prices are subject to change without prior notice, but price changes will not affect orders that have already been confirmed and paid.
                </li>
                <li>
                  <strong>Stock Availability:</strong> We maintain inventory limits to prevent over-ordering. Items are subject to availability; in the rare event an ordered item becomes unavailable after payment, we will notify you immediately and offer an exchange or full refund.
                </li>
                <li>
                  <strong>Accuracy of Descriptions:</strong> We make every reasonable effort to display product shades, sizes, and ingredients accurately. However, individual screen calibrations may affect color rendering.
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>3. Orders &amp; Payment Processing</h2>
              <p>
                When you place an order with Gracia Fab:
              </p>
              <ul>
                <li>
                  <strong>Order Confirmation:</strong> An order is deemed accepted once payment is verified through our payment provider.
                </li>
                <li>
                  <strong>Payment Methods:</strong> We accept payments through Monnify, supporting Nigerian debit cards, direct bank transfers, and USSD banking codes.
                </li>
                <li>
                  <strong>Order Cancellation:</strong> If you need to modify or cancel an order before dispatch, please notify our customer care team on WhatsApp immediately with your order reference. Once an order is handed to the dispatch courier, it cannot be recalled.
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>4. AI Advisory &amp; Cosmetic Guidance Disclaimer</h2>
              <div className="legal-card-highlight">
                <p>
                  <strong>Important Cosmetic Notice:</strong> Recommendations provided by Gracia Fab's AI Beauty Advisor, Routine Generator, and Skin Tone Detector are intended solely for general cosmetic education and styling guidance. They do not constitute medical, dermatological, or healthcare advice. Always perform a patch test prior to using new skincare formulations. If you suffer from chronic skin disorders, severe allergies, or active dermatological conditions, consult a qualified healthcare professional.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <h2>5. Account Responsibility &amp; Acceptable Use</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials. You agree not to:
              </p>
              <ul>
                <li>Use false contact or delivery information when purchasing products.</li>
                <li>Engage in payment fraud, chargeback abuse, or unauthorized card usage.</li>
                <li>Scrape, duplicate, reverse engineer, or exploit site assets or proprietary AI routines without written consent.</li>
                <li>Post defamatory, abusive, or fake reviews in the customer reviews section.</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by Nigerian law, Gracia Fab shall not be liable for indirect, incidental, or consequential damages resulting from product misuse, adverse individual skin reactions to correctly labeled ingredients, or delivery delays caused by courier logistics disruptions beyond our direct control.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Governing Law</h2>
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes arising under these terms shall be subject to amicable resolution or the jurisdiction of Nigerian courts.
              </p>
            </section>

            <section className="legal-section">
              <h2>8. Contact Information</h2>
              <div className="legal-contact-box">
                <h3>Store Inquiries &amp; Support</h3>
                <p>
                  If you have questions regarding these Terms of Service or an order, please contact our support desk:
                </p>
                <a
                  href="https://wa.me/2348037447068?text=Hello%20Gracia%20Fab%2C%20I%20have%20a%20question%20about%20your%20terms..."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-contact-link"
                >
                  Contact Gracia Fab on WhatsApp (+234 803 744 7068) →
                </a>
              </div>
            </section>

            {/* Related Legal Links */}
            <nav className="legal-nav-bar" aria-label="Related Legal Documents">
              <Link to="/privacy-policy" className="legal-nav-pill">
                Privacy Policy
              </Link>
              <Link to="/terms" className="legal-nav-pill active">
                Terms of Service
              </Link>
              <Link to="/shipping-returns" className="legal-nav-pill">
                Shipping &amp; Returns
              </Link>
            </nav>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default TermsOfService;
