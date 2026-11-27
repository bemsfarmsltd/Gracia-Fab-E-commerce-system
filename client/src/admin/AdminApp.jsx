import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import lazyWithReload from "../utils/lazyWithReload";
import ErrorBoundary from "../components/ErrorBoundary";
import AdminLogin from "./AdminLogin.jsx";
import SetPassword from "./SetPassword.jsx";
import { canUsePortal } from "../utils/portal";

const AdminDashboard = lazyWithReload(() => import("../pages/AdminDashboard"));

function Loading({ text = "Loading admin dashboard…" }) {
  return (
    <p className="admin-loading" role="status" style={{ padding: "48px 16px", textAlign: "center", minHeight: "60vh" }}>
      {text}
    </p>
  );
}

// Only the owner and staff get past here; everyone else sees the sign-in.
function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="Loading…" />;
  if (!canUsePortal(user)) return <Navigate to="/login" replace />;
  return (
    <Suspense fallback={<Loading />}>
      <AdminDashboard />
    </Suspense>
  );
}

// Routes are relative to /admin (the basename), e.g. /admin/login.
export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/*" element={<Gate />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <ErrorBoundary>
        <AdminRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
