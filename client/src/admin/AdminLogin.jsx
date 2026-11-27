import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./AdminLogin.css";

// The admin portal's own sign-in: email + password, then the code emailed to
// the admin (same second step as the shop). Accounts without admin access are
// signed straight back out.
export default function AdminLogin() {
  const { user, login, verifyOtp, resendOtp, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("password"); // "password" | "code"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (user?.isAdmin) return <Navigate to="/" replace />;

  const finish = (data) => {
    if (!data?.isAdmin) {
      logout();
      setStep("password");
      setCode("");
      setPassword("");
      setError("This account doesn't have admin access.");
      return;
    }
    navigate("/", { replace: true });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await login(email.trim(), password);
      if (data.requiresOtp) {
        setStep("code");
        setDevCode(data.devOtpCode || null);
        setNotice(`We've emailed a 6-digit code to ${data.email || email}.`);
      } else {
        finish(data);
      }
    } catch (err) {
      setError(err.message || "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      finish(await verifyOtp(email.trim(), code.trim()));
    } catch (err) {
      setError(err.message || "That code didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const data = await resendOtp(email.trim());
      setDevCode(data.devOtpCode || null);
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(err.message || "Couldn't resend the code.");
    }
  };

  return (
    <main className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-logo" aria-hidden="true">
            <img src="/icons/icon-192.png" alt="" width="56" height="56" />
          </span>
          <div>
            <p className="admin-login-title">GRACIA FAB</p>
            <p className="admin-login-tag">ADMIN PORTAL</p>
          </div>
        </div>

        {user && !user.isAdmin && step === "password" && (
          <p className="admin-login-note">
            You're signed in to the shop as {user.email}, which isn't an admin account. Sign in with an admin account below.
          </p>
        )}
        {notice && <p className="admin-login-note" role="status">{notice}</p>}
        {error && <p className="admin-login-error" role="alert">{error}</p>}

        {step === "password" ? (
          <form onSubmit={submitPassword} className="admin-login-form">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="admin-login-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="admin-login-form">
            <label htmlFor="admin-code">6-digit code</label>
            <input
              id="admin-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            {devCode && <p className="admin-login-note">Development code: {devCode}</p>}
            <button type="submit" className="admin-login-btn" disabled={busy}>{busy ? "Checking…" : "Verify and open dashboard"}</button>
            <div className="admin-login-links">
              <button type="button" className="admin-login-link" onClick={resend}>Send a new code</button>
              <button type="button" className="admin-login-link" onClick={() => { setStep("password"); setCode(""); setNotice(""); setError(""); }}>Use a different account</button>
            </div>
          </form>
        )}

        <a className="admin-login-store" href="/">← Go to the shop</a>
      </div>
    </main>
  );
}
