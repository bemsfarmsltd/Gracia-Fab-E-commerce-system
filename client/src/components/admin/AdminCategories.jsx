import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../../config";
import { useCategories, forgetShopCategories } from "../../hooks/useCategories";
import "./AdminCategories.css";

// Owner: departments and the categories inside them. Add, rename, reorder,
// hide or delete, and sort products into categories in bulk.
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function NameEditor({ initial, onSave, onCancel, label }) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="cats-rename"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <input aria-label={label} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="cats-btn is-primary">Save</button>
      <button type="button" className="cats-btn" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function Row({ item, first, last, editing, setEditing, act, isDept }) {
  const kind = isDept ? "department" : "category";
  return (
    <div className={`cats-row ${item.active ? "" : "is-hidden"} ${isDept ? "is-dept" : ""}`}>
      {editing === item._id ? (
        <NameEditor
          label={`New name for ${item.name}`}
          initial={item.name}
          onCancel={() => setEditing(null)}
          onSave={(name) => act(() => api(`/api/admin/categories/${item._id}`, { method: "PUT", body: JSON.stringify({ name }) }), `Renamed to "${name}"`)}
        />
      ) : (
        <div className="cats-row-name">
          {isDept ? <h3>{item.name}</h3> : <span>{item.name}</span>}
          <span className="cats-count">{plural(item.productCount || 0, "product")}</span>
          {!item.active && <span className="cats-badge">Hidden from the shop</span>}
        </div>
      )}
      {editing !== item._id && (
        <div className="cats-row-actions">
          <button type="button" className="cats-btn" aria-label={`Move ${item.name} up`} disabled={first} onClick={() => act("up")}>↑</button>
          <button type="button" className="cats-btn" aria-label={`Move ${item.name} down`} disabled={last} onClick={() => act("down")}>↓</button>
          <button type="button" className="cats-btn" onClick={() => setEditing(item._id)}>Rename</button>
          <button
            type="button"
            className="cats-btn"
            onClick={() => act(() => api(`/api/admin/categories/${item._id}`, { method: "PUT", body: JSON.stringify({ active: !item.active }) }), item.active ? `"${item.name}" is hidden from the shop` : `"${item.name}" shows in the shop again`)}
          >
            {item.active ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="cats-btn is-danger"
            disabled={(item.productCount || 0) > 0 || (isDept && item.children?.length > 0)}
            title={(item.productCount || 0) > 0 ? `Move its products first, or hide it` : isDept && item.children?.length ? "Delete or move its categories first, or hide it" : `Delete this ${kind}`}
            onClick={() => {
              if (window.confirm(`Delete the ${kind} "${item.name}"?`)) {
                act(() => api(`/api/admin/categories/${item._id}`, { method: "DELETE" }), `Deleted "${item.name}"`);
              }
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function AddForm({ placeholder, buttonLabel, onAdd, label }) {
  const [name, setName] = useState("");
  return (
    <form
      className="cats-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (await onAdd(name.trim())) setName("");
      }}
    >
      <input aria-label={label} placeholder={placeholder} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="cats-btn is-primary" disabled={!name.trim()}>{buttonLabel}</button>
    </form>
  );
}

function SortProducts({ tree, onDone, setNotice, setError }) {
  const [products, setProducts] = useState(null);
  const [dept, setDept] = useState("all");
  const [onlyUnsorted, setOnlyUnsorted] = useState(true);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await api("/api/admin/products"));
    } catch (err) {
      setError(err.message);
    }
  }, [setError]);

  useEffect(() => {
    // Fetch-orchestration effect: loadProducts only sets state after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
  }, [loadProducts]);

  const names = useMemo(() => {
    const m = new Map();
    for (const d of tree) for (const c of d.children) m.set(c.slug, c.name);
    return m;
  }, [tree]);
  const deptNames = useMemo(() => new Map(tree.map((d) => [d.slug, d.name])), [tree]);

  const list = (products || []).filter(
    (p) =>
      (dept === "all" || p.category === dept) &&
      (!onlyUnsorted || !p.subcategory) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.brand || "").toLowerCase().includes(q.toLowerCase())),
  );
  const allPicked = list.length > 0 && list.every((p) => picked.has(p._id));
  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const assign = async () => {
    setSaving(true);
    try {
      const { updated } = await api("/api/admin/categories/assign", {
        method: "POST",
        body: JSON.stringify({ productIds: [...picked], subcategory: target }),
      });
      setNotice(`Put ${plural(updated, "product")} in "${names.get(target)}"`);
      setPicked(new Set());
      await loadProducts();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cats-card cats-sort" aria-labelledby="cats-sort-title">
      <h3 id="cats-sort-title" className="cats-heading">Sort products into categories</h3>
      <p className="cats-muted">
        Tick products, choose a category, and put them in it. Their department follows the category you choose.
      </p>
      <div className="cats-sort-filters">
        <label>
          Department
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {tree.map((d) => (
              <option key={d.slug} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input value={q} placeholder="Product or brand" onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="cats-check">
          <input type="checkbox" checked={onlyUnsorted} onChange={(e) => setOnlyUnsorted(e.target.checked)} />
          Only products with no category yet
        </label>
      </div>

      {!products ? (
        <p className="cats-muted">Loading products...</p>
      ) : list.length === 0 ? (
        <p className="cats-muted">{onlyUnsorted ? "Every product here has a category." : "No products match."}</p>
      ) : (
        <>
          <label className="cats-check cats-all">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set([...picked, ...list.map((p) => p._id)]))}
            />
            Tick all {list.length} shown
          </label>
          <ul className="cats-products">
            {list.map((p) => (
              <li key={p._id}>
                <label className="cats-check">
                  <input type="checkbox" checked={picked.has(p._id)} onChange={() => toggle(p._id)} />
                  <span className="cats-product-name">{p.name}</span>
                  <span className="cats-product-where">
                    {deptNames.get(p.category) || p.category}
                    {p.subcategory ? ` › ${names.get(p.subcategory) || p.subcategory}` : " · no category yet"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="cats-sort-bar">
        <label>
          Put ticked products in
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a category</option>
            {tree.filter((d) => d.children.length).map((d) => (
              <optgroup key={d.slug} label={d.name}>
                {d.children.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" className="btn-admin-save" disabled={!picked.size || !target || saving} onClick={assign}>
          {saving ? "Saving..." : `Put ${plural(picked.size, "product")} in this category`}
        </button>
      </div>
    </section>
  );
}

export default function AdminCategories({ setAdminError, setAdminNotice }) {
  const { tree, loaded, error, reload } = useCategories({ admin: true });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const setError = useCallback((m) => (setAdminError ? setAdminError(m) : window.alert(m)), [setAdminError]);
  const setNotice = useCallback((m) => setAdminNotice?.(m), [setAdminNotice]);

  const refresh = useCallback(async () => {
    forgetShopCategories();
    await reload();
  }, [reload]);

  // Runs a change, then reloads. Returns true when it worked.
  const run = async (fn, notice) => {
    setBusy(true);
    try {
      await fn();
      if (notice) setNotice(notice);
      setEditing(null);
      await refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const move = (siblings, index, dir) => {
    const ids = siblings.map((s) => s._id);
    const to = dir === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    return run(() => api("/api/admin/categories/reorder", { method: "POST", body: JSON.stringify({ ids }) }));
  };
  const actFor = (siblings, index) => (what, notice) =>
    what === "up" || what === "down" ? move(siblings, index, what) : run(what, notice);

  const add = (name, parent = null) =>
    run(
      () => api("/api/admin/categories", { method: "POST", body: JSON.stringify(parent ? { name, parent } : { name }) }),
      parent ? `Added "${name}"` : `Added the department "${name}"`,
    );

  if (!loaded) {
    return (
      <div className="admin-content cats">
        {error ? <div className="admin-error" role="alert">⚠️ {error}</div> : <p className="admin-loading">Loading categories...</p>}
      </div>
    );
  }

  return (
    <div className={`admin-content cats ${busy ? "is-busy" : ""}`}>
      <section className="cats-card cats-intro">
        <p className="cats-eyebrow">How it works</p>
        <p className="cats-muted">
          Every product sits in a <strong>department</strong> (Skincare, Body care, Haircare...) and, inside it, a{" "}
          <strong>category</strong> (Serums, Bar soaps, Hair relaxers...). Shoppers filter by both. Renaming never
          breaks a product. Hide something to take it out of the shop without deleting it; only empty ones can be deleted.
        </p>
      </section>

      {tree.map((dept, d) => (
        <section key={dept._id} className={`cats-card ${dept.active ? "" : "is-hidden"}`} aria-label={dept.name}>
          <Row item={dept} isDept first={d === 0} last={d === tree.length - 1} editing={editing} setEditing={setEditing} act={actFor(tree, d)} />
          {dept.unsortedCount > 0 && (
            <p className="cats-unsorted">{plural(dept.unsortedCount, "product")} here {dept.unsortedCount === 1 ? "has" : "have"} no category yet. Use "Sort products" below.</p>
          )}
          <div className="cats-children">
            {dept.children.length === 0 && <p className="cats-muted">No categories yet.</p>}
            {dept.children.map((c, i) => (
              <Row key={c._id} item={c} first={i === 0} last={i === dept.children.length - 1} editing={editing} setEditing={setEditing} act={actFor(dept.children, i)} />
            ))}
          </div>
          <AddForm
            label={`New category in ${dept.name}`}
            placeholder={`New category in ${dept.name}, e.g. "Lip care"`}
            buttonLabel="Add category"
            onAdd={(name) => add(name, dept.slug)}
          />
        </section>
      ))}

      <section className="cats-card">
        <h3 className="cats-heading">Add a department</h3>
        <p className="cats-muted">For a whole new area of the shop, like Makeup or Men's grooming.</p>
        <AddForm label="New department" placeholder='e.g. "Makeup"' buttonLabel="Add department" onAdd={(name) => add(name)} />
      </section>

      <SortProducts tree={tree} onDone={refresh} setNotice={setNotice} setError={setError} />
    </div>
  );
}
