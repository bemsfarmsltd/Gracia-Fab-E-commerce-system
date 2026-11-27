import { useCallback, useEffect, useState } from "react";
import API_URL from "../../config";
import "./AdminStaff.css";

// Owner only: add and remove staff.
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AdminStaff({ setAdminError, setAdminNotice }) {
  const [people, setPeople] = useState([]);
  const [staffPermissions, setStaffPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/staff`, { headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't load staff.");
      setPeople(data.people || []);
      setStaffPermissions(data.staffPermissions || []);
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [setAdminError]);

  // Load the list when the screen opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const send = async (method, path, body) => {
    setAdminError?.("");
    setAdminNotice?.("");
    const res = await fetch(`${API_URL}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "That didn't work. Please try again.");
    return data;
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const added = await send("POST", "/api/admin/staff", form);
      setAdminNotice?.(added.invitePending
        ? `${added.name} has been emailed a link to set their password (valid 48 hours).`
        : `${added.name} already had an account; they can now sign in to the staff portal with their usual password.`);
      setForm({ name: "", email: "" });
      load();
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async (p) => {
    try {
      await send("POST", `/api/admin/staff/${p._id}/resend-invite`);
      setAdminNotice?.(`A new link has been emailed to ${p.email}.`);
      load();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name}'s staff access? They'll be signed out of the staff portal straight away. Their account stays as a normal shop account.`)) return;
    try {
      await send("DELETE", `/api/admin/staff/${p._id}`);
      setAdminNotice?.(`${p.name} no longer has staff access.`);
      load();
    } catch (err) {
      setAdminError?.(err.message);
    }
  };

  return (
    <section className="staff-screen">
      <div className="staff-top-grid">
        {/* Compact Add staff form card */}
        <div className="staff-card staff-form-card">
          <div className="staff-card-head">
            <span className="staff-eyebrow">Team Access</span>
            <h3 className="staff-heading">Add a staff member</h3>
          </div>
          <form className="staff-form" onSubmit={add}>
            <div className="staff-form-fields">
              <div className="staff-field">
                <label htmlFor="staff-name">Name</label>
                <input
                  id="staff-name"
                  required
                  minLength={2}
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="staff-field">
                <label htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="staff-form-actions">
              <button type="submit" className="staff-btn-primary" disabled={busy}>
                {busy ? "Adding…" : "Add staff"}
              </button>
            </div>
          </form>
        </div>

        {/* What staff can do — neat checklist */}
        {staffPermissions.length > 0 && (
          <div className="staff-card staff-perms-card">
            <div className="staff-card-head">
              <span className="staff-eyebrow">Permissions</span>
              <h3 className="staff-heading">What staff can do</h3>
            </div>
            <ul className="staff-perms-list">
              {staffPermissions.map((p) => (
                <li key={p.key} className="staff-perm-item">
                  <span className="staff-perm-check" aria-hidden="true">✓</span>
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
            <p className="staff-perms-note">
              Everything else (prices, cancellations and refunds, vouchers, sales figures, staff and the activity log) is for the owner only.
            </p>
          </div>
        )}
      </div>

      {/* Owner & Staff person cards */}
      <div className="staff-card staff-team-card">
        <div className="staff-card-head">
          <span className="staff-eyebrow">People</span>
          <h3 className="staff-heading">Portal team</h3>
        </div>

        {loading ? (
          <p className="staff-muted">Loading…</p>
        ) : people.length === 0 ? (
          <p className="staff-muted">No team members yet.</p>
        ) : (
          <div className="staff-people-grid">
            {people.map((p) => {
              const isOwner = p.role === "owner";
              return (
                <article key={p._id} className={`staff-person-card ${isOwner ? "is-owner" : ""}`}>
                  <div className="staff-person-main">
                    <div className={`staff-avatar ${isOwner ? "is-owner" : ""}`} aria-hidden="true">
                      {initialsOf(p.name)}
                    </div>
                    <div className="staff-person-info">
                      <div className="staff-person-top">
                        <h4 className="staff-person-name">{p.name}</h4>
                        <span className={`staff-role-pill ${isOwner ? "is-owner" : "is-staff"}`}>
                          {isOwner ? "Owner" : "Staff"}
                        </span>
                      </div>
                      <p className="staff-person-email">{p.email}</p>
                      <div className="staff-person-status-row">
                        <span className={`staff-status-pill ${p.invitePending ? "is-pending" : "is-active"}`}>
                          {p.invitePending ? "Invite sent" : "Active"}
                        </span>
                        {p.invitePending && (
                          <span className="staff-status-hint">Password not set yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {p.role === "staff" && (
                    <div className="staff-person-actions">
                      {p.invitePending && (
                        <button type="button" className="staff-btn-secondary" onClick={() => resend(p)}>
                          Resend link
                        </button>
                      )}
                      <button type="button" className="staff-btn-danger" onClick={() => remove(p)}>
                        Remove
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
