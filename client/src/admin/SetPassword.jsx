import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API_URL from "../config";
import "./AdminLogin.css";

// A new staff member chooses their password from the invite email
// (/admin/set-password?token=…), then signs in normally.
export default function SetPassword() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneEmail, setDoneEmail] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't set your password. Please try again.");
      setDoneEmail(data.email || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login">
      <div className="admin-login-card">
        {/* Same banner, body and footer as the sign-in (AdminLogin.css). */}
        <div className="admin-login-banner">
          <div className="admin-login-brand">
            <span className="admin-login-logo" aria-hidden="true">
              <img src="/icons/admin-icon-192.png" alt="" width="56" height="56" />
            </span>
            <div className="admin-login-brand-text">
              <p className="admin-login-title">GRACIA FAB</p>
              <p className="admin-login-tag">STAFF PORTAL</p>
            </div>
          </div>
        </div>

        <div className="admin-login-body">
        <div className="admin-login-intro">
          <h1 className="admin-login-heading">{doneEmail ? "You're all set" : "Choose your password"}</h1>
          <p className="admin-login-sub">
            {doneEmail ? "Sign in with your new password." : "You've been added to the Gracia Fab staff portal."}
          </p>
        </div>

        {doneEmail ? (
          <>
            <p className="admin-login-note" role="status">
              Your password is set{doneEmail ? ` for ${doneEmail}` : ""}. Sign in with it now; we'll also email you a 6-digit code each time.
            </p>
            <Link className="admin-login-btn" to="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              Go to sign in
            </Link>
          </>
        ) : !token ? (
          <p className="admin-login-error" role="alert">
            This link is incomplete. Open the link from your invite email again, or ask the owner to send a new one.
          </p>
        ) : (
          <form onSubmit={submit} className="admin-login-form">
            {error && <p className="admin-login-error" role="alert">{error}</p>}
            <div className="admin-login-field">
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="admin-login-field">
              <label htmlFor="confirm-password">Type it again</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" className="admin-login-btn" disabled={busy}>{busy ? "Saving…" : "Set password"}</button>
          </form>
        )}
        </div>

        <div className="admin-login-footer">
          <a className="admin-login-store" href="/">← Go to the shop</a>
          <span className="admin-login-security">Staff access only</span>
        </div>
      </div>
    </main>
  );
}
