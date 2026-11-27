import { useState, useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductsLayout from "./pages/ProductsLayout";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import lazyWithReload from "./utils/lazyWithReload";
import ErrorBoundary from "./components/ErrorBoundary";
import BackToTop from "./components/BackToTop";
import InstallPrompt from "./components/InstallPrompt";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import NotFound from "./pages/NotFound";
import AiConciergeChat from "./components/AiConciergeChat";
import { startMotion } from "./utils/motion";
import { afterLoginPath, shouldOpenAdminOnLaunch } from "./utils/afterLogin";
import "./styles/motion.css";

// Code-split pages. Only the core shopping path (home, shop, product page,
// cart, login, 404) ships in the first download; everything else loads when
// visited. lazyWithReload recovers when a stale cached app asks for a code
// file a newer deploy replaced (that once left /admin blank).
const Register = lazyWithReload(() => import("./pages/Register"));
const VerifyCode = lazyWithReload(() => import("./pages/VerifyCode"));
const About = lazyWithReload(() => import("./pages/About"));
const Contact = lazyWithReload(() => import("./pages/Contact"));
const Recommend = lazyWithReload(() => import("./pages/Recommend"));
const Checkout = lazyWithReload(() => import("./pages/Checkout"));
const OrderConfirmation = lazyWithReload(() => import("./pages/OrderConfirmation"));
const MyOrders = lazyWithReload(() => import("./pages/MyOrders"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const MyVanity = lazyWithReload(() => import("./pages/MyVanity"));
const Wishlist = lazyWithReload(() => import("./pages/Wishlist"));
const BeautyLanding = lazyWithReload(() => import("./pages/BeautyLanding"));
const SkinToneDetector = lazyWithReload(() => import("./components/SkinToneDetector"));
const SkinAnalysis = lazyWithReload(() => import("./pages/SkinAnalysis"));
const RoutineGenerator = lazyWithReload(() => import("./pages/RoutineGenerator"));
const Compare = lazyWithReload(() => import("./pages/Compare"));
const PrivacyPolicy = lazyWithReload(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithReload(() => import("./pages/TermsOfService"));
const ShippingReturns = lazyWithReload(() => import("./pages/ShippingReturns"));

function PageLoading() {
  return (
    <p className="admin-loading" role="status" style={{ padding: "48px 16px", textAlign: "center", minHeight: "60vh" }}>
      Loading…
    </p>
  );
}

// Wrapper pages
function SkinToneDetectorPage({ onCartOpen }) {
  return (
    <>
      <Navbar onCartOpen={onCartOpen} />
      <SkinToneDetector />
      <Footer />
    </>
  );
}

// ── Protected route — redirects to login if not authenticated ──
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "0.9rem",
        }}
      >
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

// ── /admin belongs to the separate admin app: leave the shop and load it ──
export function OpenAdminApp() {
  const location = useLocation();
  // If the host served the shop again for /admin (misconfigured rewrite or an
  // old offline copy), don't reload forever: try once, then explain.
  const [failed] = useState(() => {
    let last = 0;
    try { last = Number(sessionStorage.getItem("adminRedirectAt")) || 0; } catch { /* private mode */ }
    return Date.now() - last < 10000;
  });
  useEffect(() => {
    if (failed) return;
    try { sessionStorage.setItem("adminRedirectAt", String(Date.now())); } catch { /* private mode */ }
    const rest = location.pathname.replace(/^\/admin\/?/, "");
    window.location.replace(`/admin/${rest}${location.search}`);
  }, [failed, location.pathname, location.search]);
  if (failed) {
    return (
      <p role="alert" style={{ padding: "48px 16px", textAlign: "center", minHeight: "60vh" }}>
        The admin portal couldn't open. Please refresh the page, or close and reopen the app.
      </p>
    );
  }
  return <PageLoading />;
}

// ── Public only route — sends signed-in users on (My Vanity, or where they were going) ──
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (user) return <Navigate to={afterLoginPath(user, location.state?.from)} replace />;
  return children;
}

// The installed app opens the admin dashboard for admins (see afterLogin.js).
function AdminAppLaunch() {
  const { user } = useAuth() || {};
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let alreadyOpened = false;
    try { alreadyOpened = sessionStorage.getItem("adminLaunchDone") === "1"; } catch { /* private mode */ }
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (shouldOpenAdminOnLaunch({ user, pathname: location.pathname, standalone, alreadyOpened })) {
      try { sessionStorage.setItem("adminLaunchDone", "1"); } catch { /* private mode */ }
      navigate("/admin", { replace: true });
    }
  }, [user, location.pathname, navigate]);
  return null;
}

function App() {
  const [cartOpen, setCartOpen] = useState(false);

  // Springy scroll-in / hover animations site-wide (see utils/motion.js).
  useEffect(() => startMotion(), []);
  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  return (
    <Router>
      <AdminAppLaunch />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
      <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* ── Public only (redirect to home if logged in) ── */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/verify-code"
          element={<VerifyCode />}
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />
        {/* ── Public browsing — anyone can shop and build a cart without an account ── */}
        <Route path="/" element={<Home onCartOpen={openCart} />} />
        <Route
          path="/products"
          element={<ProductsLayout onCartOpen={openCart} />}
        />
        <Route
          path="/products/:id"
          element={<ProductDetail onCartOpen={openCart} />}
        />
        <Route path="/cart" element={<Cart />} />
        {/* AI Advisor is public — a shopper should get real value (matched
            products) before we ever ask them to create an account. */}
        <Route path="/recommend" element={<Recommend onCartOpen={openCart} />} />
        <Route path="/advisor" element={<Recommend onCartOpen={openCart} />} />
        <Route path="/compare" element={<Compare onCartOpen={openCart} />} />
        {/* ── Protected routes ── */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout onCartOpen={openCart} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-confirmation/:id"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-orders"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-vanity"
          element={
            <ProtectedRoute>
              <MyVanity onCartOpen={openCart} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard onCartOpen={openCart} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute>
              <Wishlist />
            </ProtectedRoute>
          }
        />
        <Route path="/about" element={<About onCartOpen={openCart} />} />
        <Route
          path="/contact"
          element={<Contact onCartOpen={openCart} />}
        />
        <Route
          path="/beauty/:slug"
          // Public on purpose: these guides are in the sitemap for Google and
          // first-time visitors, so they must not sit behind the login.
          element={<BeautyLanding onCartOpen={openCart} />}
        />
        {/* ── Admin: a separate app (client/admin/index.html, src/admin/).
            The shop has no admin code; a link to /admin from inside the shop
            loads that app with a full page load. ── */}
        <Route path="/admin/*" element={<OpenAdminApp />} />
        {/* Skin Tone Detector runs entirely client-side and calls only
            public endpoints — no reason to gate it behind login. */}
        <Route
          path="/skin-tone"
          element={<SkinToneDetectorPage onCartOpen={openCart} />}
        />
        <Route
          path="/skin-analysis"
          element={
            <ProtectedRoute>
              <SkinAnalysis onCartOpen={openCart} />
            </ProtectedRoute>
          }
        />
        {/* Public, same reasoning as /recommend — the generated routine
            is the hook; login only matters once they want to save it. */}
        <Route
          path="/routine-generator"
          element={<RoutineGenerator onCartOpen={openCart} />}
        />
        {/* ── Legal & Policy Pages (Drafts for Owner Review) ── */}
        <Route
          path="/privacy-policy"
          element={<PrivacyPolicy onCartOpen={openCart} />}
        />
        <Route
          path="/terms"
          element={<TermsOfService onCartOpen={openCart} />}
        />
        <Route
          path="/shipping-returns"
          element={<ShippingReturns onCartOpen={openCart} />}
        />
        {/* ── Catch all (branded 404 page) ── */}
        <Route path="*" element={<NotFound onCartOpen={openCart} />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <BackToTop />
      <InstallPrompt />
      <AiConciergeChat onCartOpen={openCart} />
    </Router>
  );
}

export default App;
