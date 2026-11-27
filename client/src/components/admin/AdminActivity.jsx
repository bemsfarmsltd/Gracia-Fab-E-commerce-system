import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import "./AdminLogs.css";

// The activity log: every change made in the admin, newest first, grouped by
// day. Owner only (activity.view).
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}
const lagosDate = (daysAgo = 0) => new Date(Date.now() + 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);
const dayOf = (iso) => new Date(new Date(iso).getTime() + 3600 * 1000).toISOString().slice(0, 10);
const dayLabel = (day) => {
  if (day === lagosDate(0)) return "Today";
  if (day === lagosDate(1)) return "Yesterday";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
};
const time = (iso) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

const AREAS = [
  ["", "Everything"], ["product", "Products"], ["stock", "Stock"], ["order", "Orders"], ["sale", "Shop sales"],
  ["purchase", "Deliveries"], ["stocktake", "Stock takes"], ["voucher", "Vouchers"], ["booking", "Bookings"],
  ["customer", "Customers"], ["message", "Messages"], ["staff", "Staff"], ["supplier", "Suppliers"],
];

const show = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

// Before → after details, when the entry has them.
function Details({ changes }) {
  if (!changes || typeof changes !== "object") return null;
  const rows = [];
  for (const [field, value] of Object.entries(changes)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v && typeof v === "object" && "from" in v) rows.push([v.name || field, v.from, v.to]);
        else rows.push([field, null, v]);
      }
    } else if (value && typeof value === "object" && ("from" in value || "to" in value)) {
      rows.push([field, value.from, value.to]);
    } else {
      rows.push([field, null, value]);
    }
  }
  if (!rows.length) return null;
  return (
    <details className="logs-details">
      <summary>Details</summary>
      <table>
        <tbody>
          {rows.map(([f, from, to], i) => (
            <tr key={i}><th scope="row">{f}</th><td>{from === null || from === undefined ? "" : <><span className="logs-from">{show(from)}</span> → </>}<span className="logs-to">{show(to)}</span></td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default function AdminActivity({ setAdminError }) {
  const [area, setArea] = useState("");
  const [actor, setActor] = useState("");
  const [range, setRange] = useState({ from: lagosDate(30), to: lagosDate(0) });
  const [people, setPeople] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/admin/staff").then((r) => setPeople(r.people || [])).catch(() => {});
  }, []);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50", from: range.from, to: range.to });
      if (area) q.set("action", area);
      if (actor) q.set("actor", actor);
      const list = await api(`/api/admin/activity?${q}`);
      setData((prev) => (page === 1 ? list : { ...list, items: [...prev.items, ...list.items] }));
    } catch (err) {
      setAdminError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [area, actor, range, setAdminError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(1); }, [load]);

  const days = useMemo(() => {
    const groups = [];
    for (const item of data.items) {
      const d = dayOf(item.createdAt);
      if (!groups.length || groups.at(-1).day !== d) groups.push({ day: d, items: [] });
      groups.at(-1).items.push(item);
    }
    return groups;
  }, [data.items]);

  return (
    <div className="logs">
      <section className="logs-card">
        <div className="logs-chips" role="group" aria-label="Area">
          {AREAS.map(([id, label]) => (
            <button key={id || "all"} type="button" className={`logs-chip ${area === id ? "is-on" : ""}`} aria-pressed={area === id} onClick={() => setArea(id)}>{label}</button>
          ))}
        </div>
        <div className="logs-filter-row">
          <label>Who
            <select value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Everyone</option>
              {people.map((p) => <option key={p._id} value={p._id}>{p.name}{p.role === "owner" ? " (owner)" : ""}</option>)}
            </select>
          </label>
          <label>From<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
      </section>

      <section className="logs-card">
        <h3 className="logs-heading">Changes <span className="logs-muted">({data.total})</span></h3>
        {data.items.length === 0 && !loading && <p className="logs-muted">No changes recorded for these filters.</p>}
        {days.map((g) => (
          <div key={g.day} className="logs-day">
            <p className="logs-day-label">{dayLabel(g.day)}</p>
            <ul className="logs-list logs-timeline">
              {g.items.map((a) => (
                <li key={a._id} className="logs-row">
                  <span className="logs-avatar" aria-hidden="true">{(a.actorName || "?").charAt(0).toUpperCase()}</span>
                  <div className="logs-row-main">
                    <p className="logs-row-title">{a.summary || a.action}</p>
                    <p className="logs-muted">{time(a.createdAt)} · {a.actorName || "Unknown"}</p>
                    <Details changes={a.changes} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {data.page < data.pages && (
          <button type="button" className="btn-admin-cancel" disabled={loading} onClick={() => load(data.page + 1)}>{loading ? "Loading…" : "Show more"}</button>
        )}
      </section>
    </div>
  );
}
