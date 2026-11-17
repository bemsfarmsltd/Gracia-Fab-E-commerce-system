import { useState, useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
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
import "./styles/motion.css";

// Code-split pages. Only the core shopping path (home, shop, product page,
// cart, login, 404) ships in the first download; everything else loads when
// visited. lazyWithReload recovers when a stale cached app asks for a code
// file a newer deploy replaced (that once left /admin blank).
const AdminDashboard = lazyWithReload(() => import("./pages/AdminDashboard"));
const Register = lazyWithReload(() => import("./pages/Register"));
const VerifyCode = lazyWithReload(() => import("./pages/VerifyCode"));
const About = lazyWithReload(() => import("./pages/About"));
const Contact = lazyWithReload(() => import("./pages/Contact"));
const Recommend = lazyWithReload(() => import("./pages/Recommend"));
const Checkout = lazyWithReload(() => import("./pages/Checkout"));
const OrderConfirmation = lazyWithReload(() => import("./pages/OrderConfirmation"));
const MyOrders = lazyWithReload(() => import("./pages/MyOrders"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Wishlist = lazyWithReload(() => import("./pages/Wishlist"));
const BeautyLanding = lazyWithReload(() => import("./pages/BeautyLanding"));
const SkinToneDetector = lazyWithReload(() => import("./components/SkinToneDetector"));
const SkinAnalysis = lazyWithReload(() => import("./pages/SkinAnalysis"));
const RoutineGenerator = lazyWithReload(() => import("./pages/RoutineGenerator"));
const Compare = lazyWithReload(() => import("./pages/Compare"));

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
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ── Admin route — redirects non-admins ──
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

// ── Public only route — redirects logged-in users to home ──
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  const [cartOpen, setCartOpen] = useState(false);

  // Springy scroll-in / hover animations site-wide (see utils/motion.js).
  useEffect(() => startMotion(), []);
  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  return (
    <Router>
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
          element={
            <ProtectedRoute>
              <BeautyLanding onCartOpen={openCart} />
            </ProtectedRoute>
          }
        />
        {/* ── Admin only ── */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Suspense fallback={<p className="admin-loading" style={{ padding: "48px 16px", textAlign: "center" }}>Loading admin dashboard…</p>}>
                <AdminDashboard />
              </Suspense>
            </AdminRoute>
          }
        />
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
