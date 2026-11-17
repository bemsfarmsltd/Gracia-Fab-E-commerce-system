import { Link } from "react-router-dom";
import FloatingBackHeader from "../components/FloatingBackHeader";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import "../styles/Legal.css";

function ShippingReturns({ onCartOpen }) {
  return (
    <>
      <SEO
        title="Shipping & Returns Policy"
        description="Delivery timelines across Nigeria, flat-rate shipping of ₦2,500, order tracking, and cosmetic hygiene return guidelines."
        url="/shipping-returns"
      />
      <FloatingBackHeader backLabel="Back to Store" onCartOpen={onCartOpen} />

      <main className="legal-page">
        <div className="legal-container">
          {/* Owner Review Notice */}
          <div className="legal-draft-banner" role="alert">
            <span className="legal-draft-icon" aria-hidden="true">📋</span>
            <div className="legal-draft-text">
              <strong>Draft for Store Owner Review</strong>
              This standard shipping and returns policy reflects current platform checkout rules (₦2,500 flat shipping, nationwide courier dispatch). Before public reliance, please review to ensure courier partner terms and return inspection windows match your operational workflow.
            </div>
          </div>

          <header className="legal-header">
            <span className="legal-eyebrow">Customer Care &amp; Logistics</span>
            <h1 className="legal-title">Shipping &amp; Returns</h1>
            <div className="legal-meta">
              <span>Effective Date: November 2026</span>
              <span>Status: Draft for Owner Review</span>
              <span>Coverage: Nationwide (Nigeria)</span>
            </div>
          </header>

          <article className="legal-content">
            <section className="legal-section">
              <h2>1. Delivery Coverage &amp; Flat Rate</h2>
              <p>
                Gracia Fab delivers beauty products, skincare essentials, haircare, and wigs nationwide across all 36 states and the Federal Capital Territory (Abuja).
              </p>
              <div className="legal-card-highlight">
                <p>
                  <strong>Standard Nationwide Shipping:</strong> ₦2,500 flat rate per order. Shipping fees are calculated and clearly shown at checkout before you authorize payment.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <h2>2. Processing &amp; Estimated Delivery Times</h2>
              <p>
                Orders are processed and packaged at our Lagos facility Monday through Saturday (excluding public holidays):
              </p>
              <ul>
                <li>
                  <strong>Lagos Deliveries:</strong> 2 to 3 business days following payment confirmation.
                </li>
                <li>
                  <strong>Major Cities (Abuja, Port Harcourt, Ibadan, Benin, Enugu):</strong> 3 to 5 business days.
                </li>
                <li>
                  <strong>Other States &amp; Regional Hubs:</strong> 4 to 7 business days depending on courier transit schedules.
                </li>
              </ul>
              <p>
                <em>Note:</em> In the event of adverse weather, state transit restrictions, or festive peak volume, delivery timelines may occasionally experience short delays. We will keep you updated via SMS or WhatsApp.
              </p>
            </section>

            <section className="legal-section">
              <h2>3. Order Tracking</h2>
              <p>
                Once your payment is verified and your package is dispatched, your order status is updated automatically. You can track your order at any time:
              </p>
              <ul>
                <li>
                  Visit your account <Link to="/my-orders" style={{ color: "var(--accent)", textDecoration: "underline" }}>My Orders</Link> dashboard.
                </li>
                <li>
                  Alternatively, contact our customer concierge on WhatsApp with your order reference (e.g. <code>ORD-...</code>) for real-time dispatch status.
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>4. Cosmetic Hygiene &amp; Return Guidelines</h2>
              <p>
                To protect the health, sanitation, and safety of all our customers, cosmetics and personal beauty items are subject to strict hygiene standards under applicable regulations:
              </p>
              <ul>
                <li>
                  <strong>Non-Returnable Items:</strong> Skincare products, serums, cleansers, creams, lip products, haircare formulas, and worn or customized wigs cannot be returned or exchanged once opened, unsealed, or used.
                </li>
                <li>
                  <strong>Eligible for Return or Exchange:</strong> Products that remain 100% unopened, unused, in their original manufacturer packaging with tamper-evident seals intact.
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>5. Damaged, Defective, or Incorrect Deliveries</h2>
              <p>
                We carefully inspect every parcel prior to sealing. If you receive an item that was damaged during transit or if an incorrect item was delivered:
              </p>
              <ol>
                <li>
                  <strong>Notify Us Promptly:</strong> Contact us within <strong>48 hours</strong> of parcel delivery via WhatsApp.
                </li>
                <li>
                  <strong>Provide Evidence:</strong> Send clear photos or a short video showing the outer packaging, courier label, and the damaged or incorrect item.
                </li>
                <li>
                  <strong>Resolution:</strong> Upon verification, we will promptly arrange an immediate replacement or process a full refund.
                </li>
              </ol>
            </section>

            <section className="legal-section">
              <h2>6. Refunds</h2>
              <p>
                Approved refunds are processed back to the original funding account or bank account within 3 to 5 business days following receipt and inspection of the returned parcel.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Shipping Concierge Support</h2>
              <div className="legal-contact-box">
                <h3>Need Help With Delivery or an Order?</h3>
                <p>
                  Our customer care team is available on WhatsApp to assist with delivery instructions, address corrections, or return inquiries:
                </p>
                <a
                  href="https://wa.me/2348037447068?text=Hello%20Gracia%20Fab%2C%20I%20have%20a%20shipping%20inquiry..."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-contact-link"
                >
                  Contact Dispatch Concierge on WhatsApp (+234 803 744 7068) →
                </a>
              </div>
            </section>

            {/* Related Legal Links */}
            <nav className="legal-nav-bar" aria-label="Related Legal Documents">
              <Link to="/privacy-policy" className="legal-nav-pill">
                Privacy Policy
              </Link>
              <Link to="/terms" className="legal-nav-pill">
                Terms of Service
              </Link>
              <Link to="/shipping-returns" className="legal-nav-pill active">
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

export default ShippingReturns;
