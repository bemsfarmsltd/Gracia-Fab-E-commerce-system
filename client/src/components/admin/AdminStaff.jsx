import { useCallback, useEffect, useState } from "react";
import API_URL from "../../config";

// Owner only: add and remove staff. Functional first version (Claude Code);
// Antigravity owns the look.
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

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
    <section>
      <div className="admin-form-card">
        <h3>Add a staff member</h3>
        <form onSubmit={add}>
          <div className="admin-form-grid">
            <div className="form-group">
              <label htmlFor="staff-name">Name</label>
              <input id="staff-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn-admin-save" disabled={busy}>{busy ? "Adding…" : "Add staff"}</button>
          </div>
        </form>
        {staffPermissions.length > 0 && (
          <details style={{ marginTop: "1rem" }}>
            <summary>What staff can do</summary>
            <ul style={{ margin: "0.5rem 0 0 1.2rem" }}>
              {staffPermissions.map((p) => <li key={p.key}>{p.label}</li>)}
            </ul>
            <p style={{ marginTop: "0.5rem" }}>Everything else (prices, cancellations and refunds, vouchers, sales figures, staff and the activity log) is for the owner only.</p>
          </details>
        )}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th aria-label="Actions"></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}>Loading…</td></tr>}
            {!loading && people.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.role === "owner" ? "Owner" : "Staff"}</td>
                <td>{p.invitePending ? "Invite sent, password not set yet" : "Active"}</td>
                <td>
                  {p.role === "staff" && (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {p.invitePending && <button type="button" className="btn-admin-cancel" onClick={() => resend(p)}>Resend link</button>}
                      <button type="button" className="btn-admin-cancel" onClick={() => remove(p)}>Remove</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
