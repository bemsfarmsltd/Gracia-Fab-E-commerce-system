import { useState, useMemo, useEffect } from "react";
import API_URL from "../../config";
import { can } from "../../utils/portal";
import { useCategories, forgetShopCategories } from "../../hooks/useCategories";

// The "+ Add a new category…" choice in the form's Category list.
const ADD_NEW = "__add_new__";

const STOCK_FILTERS = [
  { id: "all", label: "All Stock Levels" },
  { id: "in-stock", label: "In Stock (>5)" },
  { id: "low-stock", label: "Low Stock (1–5)" },
  { id: "out-of-stock", label: "Out of Stock (0)" },
];

const FIELD_LABELS = {
  name: "Name", description: "Description", price: "Price", image: "Main image",
  secondaryImage: "Second image", category: "Department", subcategory: "Category", brand: "Brand", stock: "Stock",
  tags: "Tags", isFeatured: "Featured",
};

const INITIAL_FORM = {
  name: "",
  description: "",
  price: "",
  image: "",
  secondaryImage: "",
  category: "skincare",
  subcategory: "",
  brand: "",
  stock: "10",
  tags: "",
  isFeatured: false,
};

export default function AdminProducts({
  user,
  products = [],
  loading = false,
  fetchProducts,
  formatPrice,
  setAdminError,
  setAdminNotice,
  getHeaders,
}) {
  const canEditProducts = user === undefined ? true : can(user, "products.edit");
  // Departments and their categories, hidden ones too (set up in Categories).
  const { tree: departmentOptions, labelFor, reload: reloadCategories } = useCategories({ admin: true });
  // "Skincare › Serums", or just the department while it has no category.
  const placeOf = (p) => (p.subcategory ? `${labelFor(p.category)} › ${labelFor(p.subcategory)}` : labelFor(p.category));

  // From the product form: name a new category in this department, save it,
  // and return its slug so the form can select it.
  const addCategoryInline = async (department) => {
    const name = window.prompt(`Name the new category in ${labelFor(department)}:`)?.trim();
    if (!name) return null;
    try {
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        method: "POST",
        headers: getHeaders ? getHeaders() : { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name, parent: department }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't add the category");
      forgetShopCategories();
      await reloadCategories();
      return data.slug;
    } catch (err) {
      setFormError(err.message);
      return null;
    }
  };
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStockFilter, setSelectedStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modal / Form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [productForm, setProductForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSecondaryImage, setUploadingSecondaryImage] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!showProductForm) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowProductForm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showProductForm]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return (products || [])
      .filter((p) => {
        if (!p) return false;
        // Search filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const name = (p.name || "").toLowerCase();
          const brand = (p.brand || "").toLowerCase();
          const tags = Array.isArray(p.tags) ? p.tags.join(" ").toLowerCase() : "";
          const desc = (p.description || "").toLowerCase();
          const sku = (p.sku || "").toLowerCase();
          const barcode = (p.barcode || "").toLowerCase();
          if (!name.includes(q) && !brand.includes(q) && !tags.includes(q) && !desc.includes(q) && !sku.includes(q) && !barcode.includes(q)) {
            return false;
          }
        }
        // Category filter: a department, a category inside one, or "no category yet"
        if (selectedCategory === "unsorted") {
          if (p.subcategory) return false;
        } else if (selectedCategory.startsWith("sub:")) {
          if (p.subcategory !== selectedCategory.slice(4)) return false;
        } else if (selectedCategory !== "all" && p.category !== selectedCategory) {
          return false;
        }
        // Stock filter
        const stockNum = Number(p.stock) || 0;
        if (selectedStockFilter === "in-stock" && stockNum <= 5) return false;
        if (selectedStockFilter === "low-stock" && (stockNum <= 0 || stockNum > 5)) return false;
        if (selectedStockFilter === "out-of-stock" && stockNum > 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
        if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
        if (sortBy === "price-asc") return (Number(a.price) || 0) - (Number(b.price) || 0);
        if (sortBy === "price-desc") return (Number(b.price) || 0) - (Number(a.price) || 0);
        if (sortBy === "stock-asc") return (Number(a.stock) || 0) - (Number(b.stock) || 0);
        if (sortBy === "stock-desc") return (Number(b.stock) || 0) - (Number(a.stock) || 0);
        // Default 'newest'
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [products, searchTerm, selectedCategory, selectedStockFilter, sortBy]);

  // Stock badge helper
  const renderStockPill = (stock) => {
    const s = Number(stock) || 0;
    if (s <= 0) {
      return (
        <span className="stock-pill stock-pill-out" title="Out of stock">
          Out of Stock
        </span>
      );
    }
    if (s <= 5) {
      return (
        <span className="stock-pill stock-pill-low" title="Only a few units remaining">
          Low Stock ({s})
        </span>
      );
    }
    return (
      <span className="stock-pill stock-pill-healthy" title="In stock">
        In Stock ({s})
      </span>
    );
  };

  // Open modal to add
  const handleAddNew = () => {
    setEditProduct(null);
    setProductForm(INITIAL_FORM);
    setFormError("");
    setFormSuccess("");
    setShowProductForm(true);
  };

  // Open modal to edit
  const handleEdit = (product) => {
    setEditProduct(product);
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price ?? "",
      image: product.image || "",
      secondaryImage: product.secondaryImage || "",
      category: product.category || "skincare",
      subcategory: product.subcategory || "",
      brand: product.brand || "",
      stock: product.stock ?? "10",
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : (product.tags || ""),
      isFeatured: Boolean(product.isFeatured),
    });
    setFormError("");
    setFormSuccess("");
    setShowProductForm(true);
  };

  // Delete product
  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Delete "${name || "this product"}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
        method: "DELETE",
        headers: getHeaders ? getHeaders() : { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete product");

      if (setAdminNotice) setAdminNotice(`Product "${name || "item"}" deleted.`);
      if (fetchProducts) fetchProducts();
    } catch (err) {
      if (setAdminError) setAdminError(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  // Cloudinary image upload handler
  const handleImageUpload = async (e, field = "image") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (JPG, PNG, WebP, etc.)");
      return;
    }

    const setUploading = field === "secondaryImage" ? setUploadingSecondaryImage : setUploadingImage;
    setUploading(true);
    setFormError("");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = reader.result.replace(/^data:image\/[a-z]+;base64,/, "");
          const mimeType = file.type;

          const res = await fetch(`${API_URL}/api/admin/upload`, {
            method: "POST",
            headers: getHeaders ? getHeaders() : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ imageBase64: base64, mimeType }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Upload failed");

          setProductForm((prev) => ({
            ...prev,
            [field]: data.url,
          }));
          setFormSuccess(`Image uploaded successfully!`);
          setTimeout(() => setFormSuccess(""), 3000);
        } catch (err) {
          setFormError(err.message || "Upload failed");
        } finally {
          setUploading(false);
        }
      };
    } catch {
      setFormError("Failed to read file");
      setUploading(false);
    }
  };

  // Submit product (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!productForm.name || !productForm.price || !productForm.image || !productForm.description) {
      return setFormError("Please fill in all required fields (Name, Price, Image, Description).");
    }

    try {
      const url = editProduct
        ? `${API_URL}/api/admin/products/${editProduct._id}`
        : `${API_URL}/api/admin/products`;

      const method = editProduct ? "PUT" : "POST";

      const tagsArray = typeof productForm.tags === "string"
        ? productForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : productForm.tags;

      const res = await fetch(url, {
        method,
        headers: getHeaders ? getHeaders() : { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          tags: tagsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Say which field the server refused, not just "Validation failed".
        const details = (data.errors || []).map((e) => `${FIELD_LABELS[e.path] || e.path}: ${e.message}`);
        throw new Error(details.length ? `Please check: ${details.join("; ")}` : data.message || "Failed to save product");
      }

      const successMsg = editProduct ? "Product updated successfully!" : "Product created successfully!";
      if (setAdminNotice) setAdminNotice(successMsg);
      setShowProductForm(false);
      setEditProduct(null);
      setProductForm(INITIAL_FORM);
      if (fetchProducts) fetchProducts();
    } catch (err) {
      setFormError(err.message || "Failed to save product");
    }
  };

  return (
    <div className="admin-products-page">
      {/* Products Top Action Bar */}
      <div className="admin-products-toolbar">
        <div className="admin-products-summary">
          <h2 className="admin-products-heading">Product Catalogue</h2>
          <span className="admin-products-count">
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>

        <div className="admin-products-toolbar-right">
          {/* View Toggle */}
          <div className="admin-view-toggle" role="group" aria-label="View layout toggle">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
            >
              <span aria-hidden="true">⊞</span> Grid
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
            >
              <span aria-hidden="true">☰</span> List
            </button>
          </div>

          {/* Add Product Button */}
          {canEditProducts && (
            <button
              type="button"
              className="btn-admin-add-product"
              onClick={handleAddNew}
              data-testid="add-product-btn"
            >
              + Add Product
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="admin-products-filters">
        {/* Search */}
        <div className="admin-search-box">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, brand, tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search products"
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="admin-filter-group">
          <label htmlFor="prod-filter-category" className="filter-label">Category:</label>
          <select
            id="prod-filter-category"
            className="admin-filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="unsorted">No category yet</option>
            {departmentOptions.map((d) => (
              <optgroup key={d.slug} label={d.name}>
                <option value={d.slug}>All {d.name}</option>
                {d.children.map((c) => (
                  <option key={c.slug} value={`sub:${c.slug}`}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Stock Filter */}
        <div className="admin-filter-group">
          <label htmlFor="prod-filter-stock" className="filter-label">Stock:</label>
          <select
            id="prod-filter-stock"
            className="admin-filter-select"
            value={selectedStockFilter}
            onChange={(e) => setSelectedStockFilter(e.target.value)}
          >
            {STOCK_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="admin-filter-group">
          <label htmlFor="prod-filter-sort" className="filter-label">Sort:</label>
          <select
            id="prod-filter-sort"
            className="admin-filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="price-asc">Price (Low → High)</option>
            <option value="price-desc">Price (High → Low)</option>
            <option value="stock-asc">Stock (Low → High)</option>
            <option value="stock-desc">Stock (High → Low)</option>
          </select>
        </div>
      </div>

      {/* Main Content: Grid vs List */}
      {loading ? (
        <div className="admin-products-loading">
          <p>Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="admin-products-empty">
          <span className="empty-icon" aria-hidden="true">🛍️</span>
          <h3>No products found</h3>
          <p>
            {searchTerm || selectedCategory !== "all" || selectedStockFilter !== "all"
              ? "Try adjusting your filters or search terms."
              : "No items have been added to the catalogue yet."}
          </p>
          {(searchTerm || selectedCategory !== "all" || selectedStockFilter !== "all") && (
            <button
              type="button"
              className="btn-clear-filters"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedStockFilter("all");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID VIEW (DashLite product-card inspiration) ── */
        <div className="admin-products-grid" data-testid="products-grid-view">
          {filteredProducts.map((product) => {
            const isDeleting = deletingId === product._id;
            const displayPrice = formatPrice ? formatPrice(product.price) : `₦${Number(product.price || 0).toLocaleString()}`;

            return (
              <div
                key={product._id}
                className={`admin-prod-card ${isDeleting ? "is-deleting" : ""}`}
                data-testid={`product-card-${product._id}`}
              >
                {/* Image Container with secondary hover */}
                <div className="admin-prod-card-media">
                  <img
                    src={product.image || "/product-placeholder.svg"}
                    alt={product.name}
                    className="admin-prod-img primary-img"
                    onError={(e) => {
                      e.currentTarget.src = "/product-placeholder.svg";
                    }}
                  />
                  {product.secondaryImage && (
                    <img
                      src={product.secondaryImage}
                      alt={`${product.name} alternate view`}
                      className="admin-prod-img secondary-img"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {product.isFeatured && (
                    <span className="prod-badge-featured" title="Featured product">
                      ★ Featured
                    </span>
                  )}
                  <span className="prod-badge-category">
                    {placeOf(product)}
                  </span>
                </div>

                {/* Card Body */}
                <div className="admin-prod-card-body">
                  <span className="admin-prod-brand">{product.brand || "Gracia Fab"}</span>
                  <h3 className="admin-prod-title" title={product.name}>
                    {product.name}
                  </h3>

                  {(product.sku || product.barcode) && (
                    <div className="admin-prod-codes">
                      {product.sku && (
                        <span className="admin-prod-code-chip" title="Shop code">
                          Code: {product.sku}
                        </span>
                      )}
                      {product.barcode && product.barcode !== product.sku && (
                        <span className="admin-prod-code-chip" title="Barcode">
                          Barcode: {product.barcode}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="admin-prod-meta-row">
                    <span className="admin-prod-price">{displayPrice}</span>
                    {renderStockPill(product.stock)}
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canEditProducts && (
                  <div className="admin-prod-card-actions">
                    <button
                      type="button"
                      className="btn-prod-quick-edit"
                      onClick={() => handleEdit(product)}
                      data-testid={`edit-product-${product._id}`}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn-prod-delete"
                      onClick={() => handleDelete(product._id, product.name)}
                      disabled={isDeleting}
                      data-testid={`delete-product-${product._id}`}
                    >
                      {isDeleting ? "..." : "🗑️ Delete"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW (DashLite product-list table inspiration) ── */
        <div className="admin-products-table-wrapper" data-testid="products-list-view">
          <table className="admin-dashlite-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock Status</th>
                <th>Featured</th>
                {canEditProducts && <th className="th-actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const isDeleting = deletingId === product._id;
                const displayPrice = formatPrice ? formatPrice(product.price) : `₦${Number(product.price || 0).toLocaleString()}`;

                return (
                  <tr key={product._id} className={isDeleting ? "is-deleting" : ""}>
                    {/* Media + Name + Brand */}
                    <td>
                      <div className="tbl-prod-media-cell">
                        <img
                          src={product.image || "/product-placeholder.svg"}
                          alt={product.name}
                          className="tbl-prod-thumb"
                          onError={(e) => {
                            e.currentTarget.src = "/product-placeholder.svg";
                          }}
                        />
                        <div className="tbl-prod-info">
                          <span className="tbl-prod-name">{product.name}</span>
                          <span className="tbl-prod-brand">{product.brand || "—"}</span>
                          {(product.sku || product.barcode) && (
                            <span className="tbl-prod-codes">
                              {product.sku ? `Code: ${product.sku}` : ""}
                              {product.sku && product.barcode && product.barcode !== product.sku ? " · " : ""}
                              {product.barcode && product.barcode !== product.sku ? `Barcode: ${product.barcode}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-pill">{placeOf(product)}</span>
                    </td>

                    {/* Price */}
                    <td>
                      <strong className="tbl-price">{displayPrice}</strong>
                    </td>

                    {/* Stock */}
                    <td>
                      {renderStockPill(product.stock)}
                    </td>

                    {/* Featured */}
                    <td>
                      {product.isFeatured ? (
                        <span className="tbl-featured-pill">★ Yes</span>
                      ) : (
                        <span className="tbl-not-featured">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    {canEditProducts && (
                      <td className="td-actions">
                        <div className="tbl-actions-group">
                          <button
                            type="button"
                            className="btn-tbl-action edit"
                            onClick={() => handleEdit(product)}
                            title="Edit product"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-tbl-action delete"
                            onClick={() => handleDelete(product._id, product.name)}
                            disabled={isDeleting}
                            title="Delete product"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD / EDIT PRODUCT MODAL ── */}
      {canEditProducts && showProductForm && (
        <div className="admin-modal-overlay" onClick={() => setShowProductForm(false)}>
          <div
            className="admin-modal-dialog admin-product-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <div className="admin-modal-header">
              <h3 id="product-modal-title">
                {editProduct ? `Edit Product: ${editProduct.name}` : "Add New Product"}
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowProductForm(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {formError && <div className="admin-error" role="alert">⚠️ {formError}</div>}
            {formSuccess && <div className="admin-success" role="status">✅ {formSuccess}</div>}

            {editProduct && (editProduct.sku || editProduct.barcode) && (
              <div className="prod-readonly-codes">
                <div className="prod-readonly-codes-row">
                  <span><strong>Shop code:</strong> {editProduct.sku || "—"}</span>
                  <span><strong>Barcode:</strong> {editProduct.barcode || "—"}</span>
                </div>
                <span className="prod-readonly-codes-hint">
                  Read-only here — change barcodes in Barcode Labels.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="admin-product-form">
              <div className="admin-form-grid">
                {/* Product Name */}
                <div className="form-group">
                  <label htmlFor="prod-form-name">Product Name *</label>
                  <input
                    id="prod-form-name"
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Vitamin C Radiance Serum"
                  />
                </div>

                {/* Brand */}
                <div className="form-group">
                  <label htmlFor="prod-form-brand">Brand *</label>
                  <input
                    id="prod-form-brand"
                    type="text"
                    required
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    placeholder="e.g. GlowLab / Gracia Fab"
                  />
                </div>

                {/* Price */}
                <div className="form-group">
                  <label htmlFor="prod-form-price">Price (₦) *</label>
                  <input
                    id="prod-form-price"
                    type="number"
                    required
                    min="0"
                    step="100"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="e.g. 12500"
                  />
                </div>

                {/* Department, then the category inside it */}
                <div className="form-group">
                  <label htmlFor="prod-form-category">Department *</label>
                  <select
                    id="prod-form-category"
                    value={productForm.category}
                    // A category belongs to one department, so changing it clears the category.
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value, subcategory: "" })}
                  >
                    {departmentOptions.map((d) => (
                      <option key={d.slug} value={d.slug}>{d.name}{d.active === false ? " (hidden)" : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="prod-form-subcategory">Category</label>
                  <select
                    id="prod-form-subcategory"
                    value={productForm.subcategory}
                    onChange={async (e) => {
                      if (e.target.value === ADD_NEW) {
                        const slug = await addCategoryInline(productForm.category);
                        if (slug) setProductForm((prev) => ({ ...prev, subcategory: slug }));
                        return;
                      }
                      setProductForm({ ...productForm, subcategory: e.target.value });
                    }}
                  >
                    <option value="">No category yet</option>
                    {(departmentOptions.find((d) => d.slug === productForm.category)?.children || []).map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}{c.active === false ? " (hidden)" : ""}</option>
                    ))}
                    {canEditProducts && <option value={ADD_NEW}>+ Add a new category…</option>}
                  </select>
                </div>

                {/* Stock Count */}
                <div className="form-group">
                  <label htmlFor="prod-form-stock">Stock Count</label>
                  <input
                    id="prod-form-stock"
                    type="number"
                    min="0"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>

                {/* Tags */}
                <div className="form-group">
                  <label htmlFor="prod-form-tags">Tags (comma-separated)</label>
                  <input
                    id="prod-form-tags"
                    type="text"
                    value={productForm.tags}
                    onChange={(e) => setProductForm({ ...productForm, tags: e.target.value })}
                    placeholder="e.g. brightening, serum, antioxidant"
                  />
                </div>
              </div>

              {/* Primary Image Upload */}
              <div className="form-group">
                <label htmlFor="prod-form-image">Primary Image URL *</label>
                <div className="upload-input-group">
                  <input
                    id="prod-form-image"
                    type="text"
                    required
                    value={productForm.image}
                    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                    placeholder="https://... or upload file"
                  />
                  <label className="btn-file-upload">
                    {uploadingImage ? "Uploading..." : "📁 Choose File"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => handleImageUpload(e, "image")}
                      disabled={uploadingImage}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>

              {/* Secondary Image Upload */}
              <div className="form-group">
                <label htmlFor="prod-form-sec-image">Secondary Image (shown on hover)</label>
                <div className="upload-input-group">
                  <input
                    id="prod-form-sec-image"
                    type="text"
                    value={productForm.secondaryImage}
                    onChange={(e) => setProductForm({ ...productForm, secondaryImage: e.target.value })}
                    placeholder="https://... or upload file"
                  />
                  <label className="btn-file-upload">
                    {uploadingSecondaryImage ? "Uploading..." : "📁 Choose File"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => handleImageUpload(e, "secondaryImage")}
                      disabled={uploadingSecondaryImage}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="prod-form-desc">Description *</label>
                <textarea
                  id="prod-form-desc"
                  rows={4}
                  required
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Accurate description from supplier packaging..."
                />
              </div>

              {/* Featured Checkbox */}
              <div className="form-group form-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={productForm.isFeatured}
                    onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                  />
                  Mark as Featured Product (spotlight on homepage)
                </label>
              </div>

              {/* Form Actions */}
              <div className="admin-form-actions">
                <button type="submit" className="btn-admin-save">
                  {editProduct ? "💾 Update Product" : "✅ Create Product"}
                </button>
                <button
                  type="button"
                  className="btn-admin-cancel"
                  onClick={() => setShowProductForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
