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
  const [showPassword, setShowPassword] = useState(false);
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
        {/* Wine Crest Header Banner */}
        <div className="admin-login-banner">
          <div className="admin-login-brand">
            <span className="admin-login-logo" aria-hidden="true">
              <img src="/icons/admin-icon-192.png" alt="" width="56" height="56" />
            </span>
            <div className="admin-login-brand-text">
              <p className="admin-login-title">GRACIA FAB</p>
              <p className="admin-login-tag">ADMIN PORTAL</p>
            </div>
          </div>

          <div className="admin-login-steps" aria-label="Sign-in steps">
            <span className={`admin-login-step ${step === "password" ? "is-active" : "is-done"}`}>
              <span className="step-num" aria-hidden="true">{step === "code" ? "✓" : "1"}</span>
              Sign in
            </span>
            <span className="admin-login-step-sep" aria-hidden="true" />
            <span className={`admin-login-step ${step === "code" ? "is-active" : ""}`}>
              <span className="step-num" aria-hidden="true">2</span>
              Email code
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="admin-login-body">
          <div className="admin-login-intro">
            <h1 className="admin-login-heading">
              {step === "password" ? "Welcome back" : "Check your email"}
            </h1>
            <p className="admin-login-sub">
              {step === "password"
                ? "Sign in with your Gracia Fab staff account to manage orders, stock and bookings."
                : "Enter the 6-digit verification code sent to your admin email address."}
            </p>
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
              <div className="admin-login-field">
                <label htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@graciafab.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-password">Password</label>
                <div className="admin-login-password-wrap">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" className="admin-login-btn" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="admin-login-form">
              <div className="admin-login-field">
                <label htmlFor="admin-code">6-digit code</label>
                <input
                  id="admin-code"
                  className="admin-login-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {devCode && <p className="admin-login-note">Development code: {devCode}</p>}
              <button type="submit" className="admin-login-btn" disabled={busy}>
                {busy ? "Checking…" : "Verify and open dashboard"}
              </button>
              <div className="admin-login-links">
                <button type="button" className="admin-login-link" onClick={resend}>
                  Send a new code
                </button>
                <button
                  type="button"
                  className="admin-login-link"
                  onClick={() => {
                    setStep("password");
                    setCode("");
                    setNotice("");
                    setError("");
                  }}
                >
                  Use a different account
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="admin-login-footer">
          <a className="admin-login-store" href="/">← Go to the shop</a>
          <span className="admin-login-security">Staff access only</span>
        </div>
      </div>
    </main>
  );
}
