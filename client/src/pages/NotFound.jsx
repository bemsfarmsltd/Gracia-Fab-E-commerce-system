import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import "../styles/NotFound.css";

function NotFound({ onCartOpen }) {
  return (
    <div className="not-found-page">
      <SEO
        title="Page Not Found — Gracia Fab"
        description="The beauty page or formulation you are looking for is no longer available or has moved."
      />
      <Navbar onCartOpen={onCartOpen} />

      <main className="not-found-main">
        <div className="not-found-card">
          <span className="not-found-badge">404 · MAISON NOTICE</span>
          <h1 className="not-found-title">Page Not Found</h1>
          <p className="not-found-desc">
            The page, formulation, or beauty collection you are seeking may have moved,
            sold out, or is temporarily undergoing reformulation.
          </p>

          <div className="not-found-actions">
            <Link to="/" className="not-found-btn not-found-btn-primary">
              Return to Storefront
            </Link>
            <Link to="/products" className="not-found-btn not-found-btn-outline">
              Browse All Products
            </Link>
            <Link to="/advisor" className="not-found-btn not-found-btn-subtle">
              ✦ Consult AI Advisor
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default NotFound;
