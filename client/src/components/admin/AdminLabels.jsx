import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API_URL from "../../config";
import { naira } from "../../utils/receipt";
import { barcodeFormat, drawBarcode } from "../../utils/barcode";
import { can } from "../../utils/portal";
import "./AdminLabels.css";

// Barcode labels on A4 sticker sheets (3 × 8 = 24 labels of 70 × 37 mm, the
// common "24 per sheet" size).
const PER_SHEET = 24;
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

function Label({ product }) {
  const svg = useRef(null);
  useEffect(() => { drawBarcode(svg.current, product.barcode, { height: 34, width: 1.4, fontSize: 11 }); }, [product.barcode]);
  return (
    <div className="label">
      <p className="label-name">{product.name}</p>
      <p className="label-price">{naira(product.price)}</p>
      <svg ref={svg} className="label-barcode" role="img" aria-label={`Barcode ${product.barcode}`} />
    </div>
  );
}

export default function AdminLabels({ user, setAdminError, setAdminNotice }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({}); // productId → labels
  const [skip, setSkip] = useState(0); // labels already used on the first sheet
  const [preview, setPreview] = useState(false);
  const canEdit = can(user, "products.edit");

  const load = useCallback(async () => {
    try {
      const list = await api("/api/admin/products");
      setProducts(Array.isArray(list) ? list : list.products || []);
    } catch (err) {
      setAdminError?.(err.message);
    }
  }, [setAdminError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search]);

  const setCount = (id, n) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(500, n || 0)) }));
  const labels = useMemo(() => {
    const list = [];
    for (const p of products) for (let i = 0; i < (counts[p._id] || 0); i++) if (p.barcode) list.push(p);
    return list;
  }, [products, counts]);
  const total = labels.length;
  const cells = [...Array(Math.min(skip, PER_SHEET - 1)).fill(null), ...labels];
  const sheets = [];
  for (let i = 0; i < cells.length; i += PER_SHEET) sheets.push(cells.slice(i, i + PER_SHEET));

  const setBarcode = async (p, value) => {
    try {
      const updated = await api(`/api/admin/products/${p._id}/barcode`, { method: "PUT", body: JSON.stringify({ barcode: value }) });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, sku: updated.sku, barcode: updated.barcode } : x)));
      setAdminNotice?.(`"${p.name}" now scans as ${updated.barcode} (${updated.barcodeType}).`);
    } catch (err) {
      setAdminError?.(err.message);
    }
  };
  const askBarcode = (p) => {
    const value = window.prompt(`Barcode printed on "${p.name}" (EAN-13 etc.). Leave empty to use the shop code ${p.sku || ""}.`, p.barcode !== p.sku ? p.barcode || "" : "");
    if (value === null) return;
    setBarcode(p, value.trim() || null);
  };

  return (
    <div className="labels">
      <section className="labels-card">
        <div className="labels-card-head">
          <div>
            <span className="labels-eyebrow">A4 Sticker Sheets · 24 per Sheet</span>
            <h3 className="labels-heading">Barcode labels</h3>
          </div>
          <button
            type="button"
            className="labels-btn-primary"
            disabled={!total}
            onClick={() => { setPreview(true); setTimeout(() => window.print(), 600); }}
          >
            Print {total} label{total === 1 ? "" : "s"}{total ? ` (${sheets.length} sheet${sheets.length === 1 ? "" : "s"})` : ""}
          </button>
        </div>

        <div className="labels-toolbar">
          <input
            className="labels-search"
            type="search"
            placeholder="Find a product, code or barcode"
            aria-label="Find a product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="labels-toolbar-actions">
            <button
              type="button"
              className="labels-btn-secondary"
              onClick={() => setCounts(Object.fromEntries(products.filter((p) => p.stock > 0).map((p) => [p._id, p.stock])))}
            >
              One label per item in stock
            </button>
            <button type="button" className="labels-btn-secondary" onClick={() => setCounts({})}>
              Clear
            </button>
          </div>

          <label className="labels-skip">
            <span>Labels already used on the first sheet</span>
            <input
              type="number"
              min="0"
              max={PER_SHEET - 1}
              value={skip}
              onChange={(e) => setSkip(Math.max(0, Math.min(PER_SHEET - 1, parseInt(e.target.value, 10) || 0)))}
            />
          </label>
        </div>

        <div className="labels-table-wrap">
          <table className="admin-table labels-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Shop code</th>
                <th>Scans as</th>
                <th>In stock</th>
                <th>Labels</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const isShopCode = p.barcode && barcodeFormat(p.barcode) === "CODE128";
                const stock = p.stock ?? 0;
                return (
                  <tr key={p._id}>
                    <td className="labels-cell-name" data-label="Product">
                      <span className="labels-prod-name">{p.name}</span>
                    </td>
                    <td className="labels-cell-price" data-label="Price">{naira(p.price)}</td>
                    <td className="labels-cell-sku" data-label="Shop code">
                      <span className="labels-code-chip">{p.sku || "—"}</span>
                    </td>
                    <td className="labels-cell-barcode" data-label="Scans as">
                      <div className="labels-barcode-meta">
                        {p.barcode ? (
                          <>
                            <span className="labels-code-text">{p.barcode}</span>
                            <span className={`labels-type ${isShopCode ? "is-shop" : "is-ean"}`}>
                              {isShopCode ? "shop code" : "product barcode"}
                            </span>
                          </>
                        ) : (
                          <span className="labels-muted">No code yet</span>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            className="labels-link"
                            onClick={() => (p.sku ? askBarcode(p) : setBarcode(p, null))}
                          >
                            {p.sku ? "Change" : "Give code"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-label="In stock">
                      <span className={`labels-stock-pill ${stock === 0 ? "is-out" : stock <= 5 ? "is-low" : "is-ok"}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="labels-cell-count" data-label="Labels">
                      <input
                        className="labels-count"
                        type="number"
                        min="0"
                        max="500"
                        inputMode="numeric"
                        disabled={!p.barcode}
                        aria-label={`Labels for ${p.name}`}
                        value={counts[p._id] || ""}
                        placeholder="0"
                        onChange={(e) => setCount(p._id, parseInt(e.target.value, 10))}
                      />
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr className="labels-empty-row">
                  <td colSpan={6}>
                    {search.trim() ? `No products match "${search.trim()}".` : "No products found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {preview && total > 0 && (
        <div className="label-sheets" aria-label="Label sheets">
          <div className="labels-preview-bar">
            <p className="labels-preview-note">
              Print preview below. In the print window choose A4, scale 100% (no &ldquo;fit to page&rdquo;), no margins.
            </p>
            <button type="button" className="labels-btn-secondary labels-close" onClick={() => setPreview(false)}>
              Close preview
            </button>
          </div>
          <div className="label-sheets-scroll">
            {sheets.map((sheet, i) => (
              <div className="label-sheet" key={i}>
                {sheet.map((p, j) => (p ? <Label key={j} product={p} /> : <div key={j} className="label label-empty" />))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
