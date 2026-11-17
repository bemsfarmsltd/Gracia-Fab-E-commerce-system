import { useState, useEffect, useCallback } from "react";
import API_URL from "../config";
import "./VoucherPanel.css";

const EMPTY_FORM = {
  code: "",
  type: "percent",
  value: "",
  minSubtotal: "",
  maxDiscount: "",
  usageLimit: "",
  expiresAt: "",
  firstOrderOnly: false,
  showOnProductPage: true,
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

// Admin dashboard → Vouchers tab. Codes created here are checked and priced
// by the server at checkout; ones marked "Show on product pages" appear in
// the product page's voucher strip with labels built from their real rules.
function VoucherPanel() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/vouchers`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't load vouchers");
      setVouchers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-orchestration effect: load() only sets state after its request
    // resolves; the rule can't see past the async call boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const update = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const send = async (url, method, body, successMessage) => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(url, { method, headers: authHeaders(), body: body && JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong");
      setNotice(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minSubtotal: Number(form.minSubtotal || 0),
      firstOrderOnly: form.firstOrderOnly,
      showOnProductPage: form.showOnProductPage,
      ...(form.maxDiscount && form.type === "percent" ? { maxDiscount: Number(form.maxDiscount) } : {}),
      ...(form.usageLimit ? { usageLimit: Number(form.usageLimit) } : {}),
      ...(form.expiresAt ? { expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString() } : {}),
    };
    const ok = await send(`${API_URL}/api/admin/vouchers`, "POST", body, `Voucher ${body.code} created.`);
    if (ok) setForm(EMPTY_FORM);
    setSaving(false);
  };

  const toggle = (v, field) =>
    send(
      `${API_URL}/api/admin/vouchers/${v._id}`,
      "PUT",
      { [field]: !v[field] },
      `${v.code} updated.`,
    );

  const remove = (v) => {
    if (!window.confirm(`Delete voucher ${v.code}? Customers won't be able to use it any more.`)) return;
    send(`${API_URL}/api/admin/vouchers/${v._id}`, "DELETE", null, `${v.code} deleted.`);
  };

  if (loading) return <p className="admin-loading">Loading vouchers...</p>;

  return (
    <div className="admin-content vouchers">
      <div className="vouchers-intro">
        <h2>Vouchers</h2>
        <p>
          Discount codes customers enter at checkout. The discount comes off the items, never
          delivery, and is checked by the server. Codes marked "Show on product pages" are
          advertised there.
        </p>
      </div>

      {error && <div className="admin-error">⚠️ {error}</div>}
      {notice && <div className="admin-success">✅ {notice}</div>}

      <form className="admin-form-card vouchers-form" onSubmit={handleCreate}>
        <h3>New voucher</h3>
        <div className="vouchers-grid">
          <label>
            Code
            <input value={form.code} onChange={update("code")} placeholder="e.g. BRIDAL10" required maxLength={30} />
          </label>
          <label>
            Type
            <select value={form.type} onChange={update("type")}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Amount off (₦)</option>
            </select>
          </label>
          <label>
            {form.type === "percent" ? "Percent off" : "Amount off (₦)"}
            <input type="number" min="1" max={form.type === "percent" ? 100 : undefined} value={form.value} onChange={update("value")} required />
          </label>
          <label>
            Minimum spend (₦)
            <input type="number" min="0" value={form.minSubtotal} onChange={update("minSubtotal")} placeholder="0" />
          </label>
          {form.type === "percent" && (
            <label>
              Max discount (₦, optional)
              <input type="number" min="1" value={form.maxDiscount} onChange={update("maxDiscount")} />
            </label>
          )}
          <label>
            Total uses (optional)
            <input type="number" min="1" value={form.usageLimit} onChange={update("usageLimit")} placeholder="Unlimited" />
          </label>
          <label>
            Ends on (optional)
            <input type="date" value={form.expiresAt} onChange={update("expiresAt")} />
          </label>
        </div>
        <div className="vouchers-checks">
          <label>
            <input type="checkbox" checked={form.firstOrderOnly} onChange={update("firstOrderOnly")} /> First order only
          </label>
          <label>
            <input type="checkbox" checked={form.showOnProductPage} onChange={update("showOnProductPage")} /> Show on product pages
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="btn-admin-save" disabled={saving}>
            {saving ? "Saving..." : "Create voucher"}
          </button>
        </div>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Conditions</th>
            <th>Used</th>
            <th>Active</th>
            <th>On product pages</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr key={v._id}>
              <td><strong>{v.code}</strong></td>
              <td>{v.discountLabel}</td>
              <td>{v.conditionLabel}</td>
              <td>{v.usedCount}{v.usageLimit ? ` / ${v.usageLimit}` : ""}</td>
              <td>
                <button type="button" className={`voucher-toggle ${v.active ? "on" : "off"}`} onClick={() => toggle(v, "active")} aria-pressed={v.active} aria-label={`${v.code} active`}>
                  {v.active ? "Active" : "Off"}
                </button>
              </td>
              <td>
                <button type="button" className={`voucher-toggle ${v.showOnProductPage ? "on" : "off"}`} onClick={() => toggle(v, "showOnProductPage")} aria-pressed={v.showOnProductPage} aria-label={`${v.code} shown on product pages`}>
                  {v.showOnProductPage ? "Shown" : "Hidden"}
                </button>
              </td>
              <td>
                <button type="button" className="btn-delete" onClick={() => remove(v)}>🗑️ Delete</button>
              </td>
            </tr>
          ))}
          {vouchers.length === 0 && (
            <tr>
              <td colSpan={7} className="vouchers-empty">No vouchers yet. Create one above.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default VoucherPanel;
