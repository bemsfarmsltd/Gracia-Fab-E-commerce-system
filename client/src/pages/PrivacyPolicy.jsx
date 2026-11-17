import { Link } from "react-router-dom";
import FloatingBackHeader from "../components/FloatingBackHeader";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import "../styles/Legal.css";

function PrivacyPolicy({ onCartOpen }) {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Learn how Gracia Fab collects, uses, and safeguards your personal information, beauty profile answers, and order data."
        url="/privacy-policy"
      />
      <FloatingBackHeader backLabel="Back to Store" onCartOpen={onCartOpen} />

      <main className="legal-page">
        <div className="legal-container">
          {/* Owner Review Notice */}
          <div className="legal-draft-banner" role="alert">
            <span className="legal-draft-icon" aria-hidden="true">📋</span>
            <div className="legal-draft-text">
              <strong>Draft for Store Owner Review</strong>
              This standard privacy policy is prepared as a draft for Gracia Fab. Before public reliance or formal compliance certification, please review with your legal counsel and replace placeholder contact details with your verified business registration information.
            </div>
          </div>

          <header className="legal-header">
            <span className="legal-eyebrow">Trust &amp; Transparency</span>
            <h1 className="legal-title">Privacy Policy</h1>
            <div className="legal-meta">
              <span>Effective Date: November 2026</span>
              <span>Status: Draft for Owner Review</span>
              <span>Region: Federal Republic of Nigeria</span>
            </div>
          </header>

          <article className="legal-content">
            <section className="legal-section">
              <h2>1. Overview</h2>
              <p>
                Gracia Fab (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the Gracia Fab e-commerce platform and AI beauty advisory services. We respect your personal privacy and are committed to protecting the information you share when browsing our catalog, using our beauty advisors, creating an account, or purchasing products.
              </p>
              <p>
                This Privacy Policy outlines what information we collect, why we collect it, how it is secured, and your rights regarding your personal data.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. Information We Collect</h2>
              <p>We only collect personal information that is reasonably necessary to provide our products and beauty advisory services:</p>
              <ul>
                <li>
                  <strong>Account &amp; Contact Details:</strong> When you register or place an order, we collect your name, email address, phone number, and delivery address.
                </li>
                <li>
                  <strong>Beauty Profile &amp; Preferences:</strong> When you complete our AI Beauty Advisor consultation, Routine Generator, or Skin Tone consultation, we record your selected answers (e.g. skin type, primary skin concerns, hair goals) to generate personalized recommendations.
                </li>
                <li>
                  <strong>Order &amp; Transaction History:</strong> Records of products ordered, totals paid in Nigerian Naira (₦), delivery status, and order tracking numbers.
                </li>
                <li>
                  <strong>Communications:</strong> Messages and inquiries sent to our customer care team via WhatsApp or contact forms.
                </li>
              </ul>
              <div className="legal-card-highlight">
                <p>
                  <strong>Payment Card &amp; Bank Data:</strong> All payments on Gracia Fab are processed directly by our licensed payment partner, <strong>Monnify</strong>. We do not store, process, or have access to your full debit card numbers, PINs, or banking passwords on our servers.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <h2>3. How We Use Your Information</h2>
              <p>We process your data for lawful operational purposes, including:</p>
              <ul>
                <li>Fulfilling and dispatching your orders to your delivery address across Nigeria.</li>
                <li>Generating customized beauty product routines tailored to your climate and skin needs.</li>
                <li>Sending order confirmations, shipping updates, and service notifications.</li>
                <li>Providing responsive customer support via WhatsApp and email.</li>
                <li>Preventing fraudulent transactions and ensuring store security.</li>
                <li>Sending promotional beauty tips and voucher codes if you opted into our newsletter (you may unsubscribe at any time).</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>4. Cookies &amp; Local Storage</h2>
              <p>
                Our web application uses browser cookies and local storage strictly to ensure core site functionality:
              </p>
              <ul>
                <li><strong>Session &amp; Authentication:</strong> Remembering your logged-in state across pages.</li>
                <li><strong>Shopping Bag:</strong> Retaining your selected bag items during your browsing session.</li>
                <li><strong>Preferences:</strong> Saving theme settings (dark/light mode) and recently viewed products.</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>5. Data Sharing &amp; Third Parties</h2>
              <p>
                We do not sell, rent, or trade your personal information to third-party marketers. We only share information with trusted third parties necessary for fulfillment:
              </p>
              <ul>
                <li><strong>Payment Processors:</strong> Monnify, to safely authorize and verify payments.</li>
                <li><strong>Delivery &amp; Courier Partners:</strong> Logistics couriers who require your name, phone number, and address to deliver parcels.</li>
                <li><strong>Cloud Infrastructure:</strong> Secure cloud hosting services hosting our verified database and APIs.</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>6. Your Rights</h2>
              <p>
                You have the right to access, update, or request deletion of your personal account data at any time. You can view your past orders in your account dashboard or contact us to request data removal or correction.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Contact &amp; Questions</h2>
              <div className="legal-contact-box">
                <h3>Customer Care &amp; Privacy Inquiries</h3>
                <p>
                  For any questions about your personal data or this policy, please reach out to our team:
                </p>
                <a
                  href="https://wa.me/2348037447068?text=Hello%20Gracia%20Fab%2C%20I%20have%20a%20privacy%20question..."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-contact-link"
                >
                  Message Gracia Fab on WhatsApp (+234 803 744 7068) →
                </a>
              </div>
            </section>

            {/* Related Legal Links */}
            <nav className="legal-nav-bar" aria-label="Related Legal Documents">
              <Link to="/privacy-policy" className="legal-nav-pill active">
                Privacy Policy
              </Link>
              <Link to="/terms" className="legal-nav-pill">
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

export default PrivacyPolicy;
