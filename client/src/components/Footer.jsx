import { useState } from "react";
import { Link } from "react-router-dom";
import API_URL from "../config";
import "./Footer.css";

function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setSignupError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/contact/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Subscription failed.");

      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setSignupError(
        err.message || "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="ysl-footer">
      <div className="ysl-footer-top">
        {/* ── Top row: brand block + newsletter block ── */}
        <div className="ysl-footer-row-top">
          <div className="ysl-footer-brand-col">
            <Link to="/" className="ysl-footer-logo">
              Gracia Fab <span className="ysl-footer-logo-star">✦</span>
            </Link>
            <p className="ysl-footer-tagline">
              AI-powered beauty for skincare, haircare, wigs &amp; bridal.
            </p>

            <div className="ysl-footer-contact">
              <a
                href="https://wa.me/2348037447068?text=Hi%20Gracia%20Fab!%20I%20need%20help%20with..."
                target="_blank"
                rel="noopener noreferrer"
                className="ysl-footer-contact-link"
              >
                <span className="ysl-footer-contact-icon" aria-hidden="true">☎</span>
                Message us on WhatsApp
              </a>
              <span className="ysl-footer-contact-link ysl-footer-contact-text">
                <span className="ysl-footer-contact-icon" aria-hidden="true">📍</span>
                Umuahia, Abia State, Nigeria
              </span>
            </div>

            <div className="ysl-footer-social-row">
              <a href="https://www.instagram.com/thebemsgroup" target="_blank" rel="noopener noreferrer" aria-label="Instagram (The Bems Group)">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://www.facebook.com/thebemsgroup" target="_blank" rel="noopener noreferrer" aria-label="Facebook (The Bems Group)">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>

          <div className="ysl-footer-newsletter-col">
            <h3 className="ysl-footer-newsletter-title">Join the Beauty Club!</h3>
            <p className="ysl-footer-newsletter-desc">
              Get AI beauty tips, new arrivals &amp; exclusive offers straight to your inbox.
            </p>

            {submitted ? (
              <div className="ysl-signup-success">
                <span className="ysl-check-icon">✓</span>
                <span>You&rsquo;re on the list — check your inbox for your welcome gift.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="ysl-signup-form">
                {signupError && (
                  <div className="ysl-signup-error">⚠️ {signupError}</div>
                )}
                <div className="ysl-newsletter-input-row">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ysl-footer-input"
                  />
                  <button
                    type="submit"
                    className="ysl-footer-submit-btn"
                    disabled={submitting}
                  >
                    {submitting ? "…" : "Subscribe"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Link columns ── */}
        <div className="ysl-footer-links-grid">
          <div className="ysl-footer-col">
            <h3 className="ysl-footer-col-title">Explore</h3>
            <ul className="ysl-footer-links">
              <li><Link to="/about">About Gracia Fab</Link></li>
              <li><Link to="/recommend">AI Beauty Advisor</Link></li>
              <li><Link to="/skin-analysis">AI Skin Analysis</Link></li>
              <li><Link to="/routine-generator">Routine Generator</Link></li>
              <li><Link to="/skin-tone">Skin Tone Detector</Link></li>
            </ul>
          </div>

          <div className="ysl-footer-col">
            <h3 className="ysl-footer-col-title">Shop</h3>
            <ul className="ysl-footer-links">
              <li><Link to="/products?category=skincare">Skincare</Link></li>
              <li><Link to="/products?category=haircare">Haircare</Link></li>
              <li><Link to="/products?category=wig">Wigs</Link></li>
              <li><Link to="/products?category=bridal">Bridal Beauty</Link></li>
              <li><Link to="/products">View All Products</Link></li>
            </ul>
          </div>

          <div className="ysl-footer-col">
            <h3 className="ysl-footer-col-title">Customer Care</h3>
            <ul className="ysl-footer-links">
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/my-orders">Track Your Order</Link></li>
              <li><Link to="/shipping-returns">Shipping &amp; Returns</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/dashboard">My Account</Link></li>
              <li><Link to="/wishlist">Wishlist</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="ysl-footer-bottom">
        <div className="ysl-footer-copy">
          © {new Date().getFullYear()} Gracia Fab <span className="ysl-footer-copy-star">✦</span> NG
        </div>
        <div className="ysl-footer-legal-links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms of Service</Link>
          <span aria-hidden="true">·</span>
          <Link to="/shipping-returns">Shipping &amp; Returns</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
