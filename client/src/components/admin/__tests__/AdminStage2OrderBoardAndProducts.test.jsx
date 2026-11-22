import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSidebar from "../AdminSidebar";
import AdminHeader from "../AdminHeader";
import AdminOrderBoard from "../AdminOrderBoard";
import AdminProducts from "../AdminProducts";

const mockOrders = [
  {
    _id: "674011111111111111110001",
    user: { name: "Chioma Adeleke", email: "chioma@example.com", phone: "08011112222" },
    shippingAddress: { fullName: "Chioma Adeleke", phone: "08011112222", city: "Ikeja", state: "Lagos" },
    orderItems: [{ name: "Hydrating Rosewater Toner", qty: 2, price: 6500 }],
    totalPrice: 15500,
    isPaid: true,
    status: "paid",
    createdAt: "2026-11-22T09:00:00.000Z",
  },
  {
    _id: "674011111111111111110002",
    user: { name: "Amaka Eze", email: "amaka@example.com", phone: "08033334444" },
    shippingAddress: { fullName: "Amaka Eze", phone: "08033334444", city: "Umuahia", state: "Abia" },
    orderItems: [{ name: "Raw Virgin Hair Wig 24inch", qty: 1, price: 145000 }],
    totalPrice: 147500,
    isPaid: true,
    status: "processing",
    createdAt: "2026-11-22T10:30:00.000Z",
  },
  {
    _id: "674011111111111111110003",
    user: { name: "Fatima Bello", email: "fatima@example.com", phone: "08055556666" },
    shippingAddress: { fullName: "Fatima Bello", phone: "08055556666", city: "Abuja", state: "FCT" },
    orderItems: [{ name: "Vitamin C Brightening Serum", qty: 1, price: 12500 }],
    totalPrice: 15000,
    isPaid: true,
    status: "shipped",
    createdAt: "2026-11-21T14:00:00.000Z",
  },
  {
    _id: "674011111111111111110004",
    user: { name: "Zainab Usman", email: "zainab@example.com", phone: "08077778888" },
    shippingAddress: { fullName: "Zainab Usman", phone: "08077778888", city: "Port Harcourt", state: "Rivers" },
    orderItems: [{ name: "Bridal Veil & Tiara Set", qty: 1, price: 35000 }],
    totalPrice: 37500,
    isPaid: true,
    status: "delivered",
    createdAt: "2026-11-20T11:00:00.000Z",
  },
  {
    _id: "674011111111111111110005",
    user: { name: "Unpaid Customer", email: "unpaid@example.com" },
    shippingAddress: { fullName: "Unpaid Customer", city: "Lagos" },
    orderItems: [{ name: "Sample Item", qty: 1, price: 5000 }],
    totalPrice: 7500,
    isPaid: false, // Unpaid order - should NOT be on board
    status: "pending",
    createdAt: "2026-11-22T12:00:00.000Z",
  },
  {
    _id: "674011111111111111110006",
    user: { name: "Cancelled Customer", email: "cancelled@example.com" },
    shippingAddress: { fullName: "Cancelled Customer", city: "Lagos" },
    orderItems: [{ name: "Cancelled Item", qty: 1, price: 8000 }],
    totalPrice: 10500,
    isPaid: true,
    status: "cancelled", // Cancelled order - should NOT be on board
    createdAt: "2026-11-22T08:00:00.000Z",
  },
];

const mockProducts = [
  {
    _id: "prod001",
    name: "Vitamin C Brightening Serum",
    brand: "GlowLab",
    category: "skincare",
    price: 12500,
    stock: 14, // Healthy stock
    image: "https://example.com/serum.jpg",
    secondaryImage: "https://example.com/serum-alt.jpg",
    description: "Pure radiance boosting antioxidant serum.",
    isFeatured: true,
    tags: ["brightening", "serum", "vitamin c"],
    createdAt: "2026-11-20T00:00:00.000Z",
  },
  {
    _id: "prod002",
    name: "Raw Virgin Hair Wig 24inch",
    brand: "Gracia Fab",
    category: "wig",
    price: 145000,
    stock: 3, // Low stock (<= 5)
    image: "https://example.com/wig.jpg",
    secondaryImage: "",
    description: "100% human hair frontal lace wig.",
    isFeatured: false,
    tags: ["wig", "virgin hair", "24inch"],
    createdAt: "2026-11-21T00:00:00.000Z",
  },
  {
    _id: "prod003",
    name: "Bridal Glow Makeup Kit",
    brand: "Bems Beauty",
    category: "bridal",
    price: 45000,
    stock: 0, // Out of stock
    image: "https://example.com/bridal.jpg",
    secondaryImage: "",
    description: "Luxury wedding day glam essentials.",
    isFeatured: true,
    tags: ["bridal", "makeup", "kit"],
    createdAt: "2026-11-22T00:00:00.000Z",
  },
];

const formatPrice = (val) => `₦${Number(val || 0).toLocaleString()}`;

describe("Admin Stage 2: Navigation & Header", () => {
  it("enables Order Board tab without disabled state or Stage 2 badge", () => {
    const setActiveTab = vi.fn();
    render(
      <MemoryRouter>
        <AdminSidebar
          activeTab="orders"
          setActiveTab={setActiveTab}
          mobileOpen={false}
          setMobileOpen={vi.fn()}
          user={{ name: "Admin User", isAdmin: true }}
          logout={vi.fn()}
        />
      </MemoryRouter>
    );

    const orderBoardBtn = screen.getByRole("button", { name: /Order Board/i });
    expect(orderBoardBtn).toBeDefined();
    expect(orderBoardBtn.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Stage 2")).toBeNull();

    fireEvent.click(orderBoardBtn);
    expect(setActiveTab).toHaveBeenCalledWith("orderboard");
  });

  it("renders Order Board title and subtitle in AdminHeader", () => {
    render(
      <MemoryRouter>
        <AdminHeader
          activeTab="orderboard"
          setMobileOpen={vi.fn()}
          adminError=""
          adminNotice=""
          user={{ email: "admin@graciafab.com" }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Order Board" })).toBeDefined();
    expect(screen.getByText("Visual workflow from payment to packing, shipping and delivery")).toBeDefined();
  });
});

describe("Admin Stage 2: Order Board (Kanban)", () => {
  let handleUpdateStatus;
  let setAdminError;
  let setAdminNotice;

  beforeEach(() => {
    handleUpdateStatus = vi.fn().mockResolvedValue({});
    setAdminError = vi.fn();
    setAdminNotice = vi.fn();
    vi.restoreAllMocks();
  });

  it("renders 4 kanban columns and filters out unpaid and cancelled orders", () => {
    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    // Columns present
    expect(screen.getByTestId("kanban-column-paid")).toBeDefined();
    expect(screen.getByTestId("kanban-column-processing")).toBeDefined();
    expect(screen.getByTestId("kanban-column-shipped")).toBeDefined();
    expect(screen.getByTestId("kanban-column-delivered")).toBeDefined();

    // 4 active paid orders on board
    expect(screen.getByText(/4 active orders on board/i)).toBeDefined();

    // Unpaid & Cancelled orders must NOT appear
    expect(screen.queryByText(/Unpaid Customer/i)).toBeNull();
    expect(screen.queryByText(/Cancelled Customer/i)).toBeNull();

    // Eligible orders appear in their columns
    expect(screen.getByText(/Chioma Adeleke/i)).toBeDefined();
    expect(screen.getByText(/Amaka Eze/i)).toBeDefined();
    expect(screen.getByText(/Fatima Bello/i)).toBeDefined();
    expect(screen.getByText(/Zainab Usman/i)).toBeDefined();
  });

  it("asks for confirmation before advancing order to next status", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    // Paid order has "Start Packing →" button
    const advancePaidBtn = screen.getByTestId("advance-btn-674011111111111111110001");
    expect(advancePaidBtn.textContent).toContain("Start Packing →");

    fireEvent.click(advancePaidBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Move order #.* to "processing"/));
    // Customers are only messaged on shipped and delivered, so packing
    // mustn't promise them a message.
    expect(confirmSpy.mock.calls[0][0]).not.toMatch(/email|WhatsApp/i);
    expect(handleUpdateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "674011111111111111110001" }),
      "processing"
    );
  });

  it("does not advance order if staff cancels the confirmation dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    const advanceProcessingBtn = screen.getByTestId("advance-btn-674011111111111111110002");
    expect(advanceProcessingBtn.textContent).toContain("Mark Shipped →");

    fireEvent.click(advanceProcessingBtn);

    expect(handleUpdateStatus).not.toHaveBeenCalled();
  });

  it("enforces strict state machine and prevents invalid transitions", async () => {
    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    // Drop paid order directly onto delivered column
    const deliveredCol = screen.getByTestId("kanban-column-delivered");
    fireEvent.drop(deliveredCol, {
      dataTransfer: {
        getData: (type) => (type === "text/plain" ? "674011111111111111110001" : ""),
      },
    });

    expect(setAdminError).toHaveBeenCalledWith(
      expect.stringMatching(/Cannot move order directly from "paid" to "delivered"/i)
    );
    expect(handleUpdateStatus).not.toHaveBeenCalled();
  });

  it("filters cards across all columns by search input", () => {
    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search by order #, customer/i);
    fireEvent.change(searchInput, { target: { value: "Rosewater" } });

    expect(screen.getByText(/Chioma Adeleke/i)).toBeDefined();
    expect(screen.queryByText(/Amaka Eze/i)).toBeNull();
    expect(screen.queryByText(/Fatima Bello/i)).toBeNull();
  });

  it("switches columns via mobile quick selector tabs", () => {
    render(
      <AdminOrderBoard
        orders={mockOrders}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={handleUpdateStatus}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    // Click "Processing" tab
    const processingTab = screen.getByRole("tab", { name: /^Processing/i });
    fireEvent.click(processingTab);

    // Processing column stays visible, others have mobile-hidden class
    const processingCol = screen.getByTestId("kanban-column-processing");
    const paidCol = screen.getByTestId("kanban-column-paid");

    expect(processingCol.className).not.toContain("mobile-hidden");
    expect(paidCol.className).toContain("mobile-hidden");
  });
});

describe("Admin Stage 2: Products Catalogue (Grid & List View)", () => {
  let fetchProducts;
  let setAdminError;
  let setAdminNotice;

  beforeEach(() => {
    fetchProducts = vi.fn();
    setAdminError = vi.fn();
    setAdminNotice = vi.fn();
    vi.restoreAllMocks();
  });

  it("renders products in grid view with correct stock pills and categories", () => {
    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({})}
      />
    );

    expect(screen.getByTestId("products-grid-view")).toBeDefined();
    expect(screen.getByText("Vitamin C Brightening Serum")).toBeDefined();
    expect(screen.getByText("Raw Virgin Hair Wig 24inch")).toBeDefined();
    expect(screen.getByText("Bridal Glow Makeup Kit")).toBeDefined();

    // Stock pills
    expect(screen.getByText("In Stock (14)")).toBeDefined();
    expect(screen.getByText("Low Stock (3)")).toBeDefined();
    expect(screen.getByText("Out of Stock")).toBeDefined();
  });

  it("toggles between Grid and List view modes", () => {
    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({})}
      />
    );

    expect(screen.getByTestId("products-grid-view")).toBeDefined();

    const listBtn = screen.getByRole("button", { name: /List/i });
    fireEvent.click(listBtn);

    expect(screen.getByTestId("products-list-view")).toBeDefined();
    expect(screen.queryByTestId("products-grid-view")).toBeNull();

    const gridBtn = screen.getByRole("button", { name: /Grid/i });
    fireEvent.click(gridBtn);

    expect(screen.getByTestId("products-grid-view")).toBeDefined();
  });

  it("filters products by category and stock level", () => {
    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({})}
      />
    );

    // Filter by category: Wig
    const categorySelect = screen.getByLabelText(/^Category:/i);
    fireEvent.change(categorySelect, { target: { value: "wig" } });

    expect(screen.getByText("Raw Virgin Hair Wig 24inch")).toBeDefined();
    expect(screen.queryByText("Vitamin C Brightening Serum")).toBeNull();
    expect(screen.queryByText("Bridal Glow Makeup Kit")).toBeNull();

    // Reset category to all and filter by stock: low-stock
    fireEvent.change(categorySelect, { target: { value: "all" } });
    const stockSelect = screen.getByLabelText(/^Stock:/i);
    fireEvent.change(stockSelect, { target: { value: "low-stock" } });

    expect(screen.getByText("Raw Virgin Hair Wig 24inch")).toBeDefined();
    expect(screen.queryByText("Vitamin C Brightening Serum")).toBeNull();
    expect(screen.queryByText("Bridal Glow Makeup Kit")).toBeNull();
  });

  it("opens Add Product modal and submits new product", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ _id: "new_prod", name: "New Argan Oil" }),
    });

    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({ Authorization: "Bearer token" })}
      />
    );

    const addBtn = screen.getByTestId("add-product-btn");
    fireEvent.click(addBtn);

    expect(screen.getByRole("heading", { name: "Add New Product" })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Product Name \*/i), { target: { value: "New Argan Oil" } });
    fireEvent.change(screen.getByLabelText(/Brand \*/i), { target: { value: "Gracia Fab" } });
    fireEvent.change(screen.getByLabelText(/Price \(₦\) \*/i), { target: { value: "9500" } });
    fireEvent.change(screen.getByLabelText(/Primary Image URL \*/i), { target: { value: "https://example.com/oil.jpg" } });
    fireEvent.change(screen.getByLabelText(/Description \*/i), { target: { value: "Nourishing organic argan hair oil." } });

    const submitBtn = screen.getByRole("button", { name: /Create Product/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/products"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"name":"New Argan Oil"'),
        })
      );
    });

    expect(fetchProducts).toHaveBeenCalled();
  });

  it("opens Edit Product modal pre-filled and handles update", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ _id: "prod001", name: "Vitamin C Serum (Updated)" }),
    });

    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({ Authorization: "Bearer token" })}
      />
    );

    const editBtn = screen.getByTestId("edit-product-prod001");
    fireEvent.click(editBtn);

    expect(screen.getByRole("heading", { name: /Edit Product: Vitamin C Brightening Serum/i })).toBeDefined();
    const nameInput = screen.getByLabelText(/Product Name \*/i);
    expect(nameInput.value).toBe("Vitamin C Brightening Serum");

    fireEvent.change(nameInput, { target: { value: "Vitamin C Serum (Updated)" } });

    const updateBtn = screen.getByRole("button", { name: /Update Product/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/products/prod001"),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"name":"Vitamin C Serum (Updated)"'),
        })
      );
    });

    expect(fetchProducts).toHaveBeenCalled();
  });

  it("confirms before deleting a product", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <AdminProducts
        products={mockProducts}
        loading={false}
        fetchProducts={fetchProducts}
        formatPrice={formatPrice}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
        getHeaders={() => ({ Authorization: "Bearer token" })}
      />
    );

    const deleteBtn = screen.getByTestId("delete-product-prod002");
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Delete "Raw Virgin Hair Wig 24inch"/i)
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/products/prod002"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    expect(fetchProducts).toHaveBeenCalled();
  });
});
