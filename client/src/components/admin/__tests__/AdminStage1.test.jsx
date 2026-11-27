import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSidebar from "../AdminSidebar";
import AdminHeader from "../AdminHeader";
import AdminOverview from "../AdminOverview";
import AdminOrders from "../AdminOrders";
import AdminMiniChart from "../AdminMiniChart";

const mockOverviewData = {
  generatedAt: "2026-11-22T12:00:00.000Z",
  timezone: "Africa/Lagos",
  totals: {
    revenue: 125000,
    paidOrders: 2,
    averageOrderValue: 62500,
    customers: 8,
    products: 15,
  },
  last7: { revenue: 62500, paidOrders: 1, newCustomers: 3 },
  prev7: { revenue: 0, paidOrders: 0, newCustomers: 0 },
  last30: { revenue: 125000, paidOrders: 2, newCustomers: 6 },
  prev30: { revenue: 0, paidOrders: 0, newCustomers: 0 },
  daily: [
    { date: "2026-11-21", revenue: 62500, paidOrders: 1, newCustomers: 2 },
    { date: "2026-11-22", revenue: 62500, paidOrders: 1, newCustomers: 1 },
  ],
  statusCounts: {
    pending: 1,
    paid: 0,
    processing: 2,
    shipped: 1,
    delivered: 4,
    cancelled: 1,
  },
  recentOrders: [
    {
      _id: "ord674011111111111111111111",
      user: { name: "Ngozi Obi", email: "ngozi@example.com" },
      totalPrice: 62500,
      status: "processing",
      createdAt: "2026-11-22T10:00:00.000Z",
    },
  ],
  lowStockThreshold: 5,
  lowStock: [{ name: "Glowing Serum", stock: 2, category: "skincare" }],
  outOfStockCount: 1,
};

const mockOrdersList = [
  {
    _id: "o111111111111111111111111",
    user: { name: "Amaka Eze", email: "amaka@example.com" },
    deliveryAddress: { fullName: "Amaka Eze", phone: "08012345678", streetAddress: "12 Library Ave", city: "Umuahia", state: "Abia" },
    orderItems: [{ name: "Body Wave Lace Wig", quantity: 1, price: 85000, image: "/wig.jpg" }],
    totalPrice: 87500,
    isPaid: true,
    status: "processing",
    createdAt: "2026-11-22T08:00:00.000Z",
    refund: { status: "none" },
  },
  {
    _id: "o222222222222222222222222",
    user: { name: "Chioma Kalu", email: "chioma@example.com" },
    deliveryAddress: { fullName: "Chioma Kalu", phone: "08087654321", streetAddress: "5 Aba Rd", city: "Umuahia", state: "Abia" },
    orderItems: [
      { name: "Curl Cream", quantity: 1, price: 7800 },
      { name: "Shea Lotion", quantity: 2, price: 6000 },
    ],
    totalPrice: 22300,
    isPaid: false,
    status: "pending",
    createdAt: "2026-11-21T14:00:00.000Z",
    refund: { status: "none" },
  },
];

const formatPrice = (p) => `₦${Number(p).toLocaleString()}`;

describe("Admin Stage 1 Components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("AdminMiniChart", () => {
    it("renders SVG with polyline path and area gradient", () => {
      const { container } = render(
        <AdminMiniChart data={[10, 25, 18, 40, 32]} strokeColor="#D4AF37" height={40} />
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(2); // area path + line path
    });

    it("handles empty data gracefully without throwing", () => {
      const { container } = render(<AdminMiniChart data={[]} />);
      expect(container.querySelector(".admin-mini-chart-empty")).toBeInTheDocument();
    });
  });

  describe("AdminSidebar", () => {
    it("renders all sections and switches active tab", () => {
      const setActiveTab = vi.fn();
      const setMobileOpen = vi.fn();
      render(
        <MemoryRouter>
          <AdminSidebar
            activeTab="overview"
            setActiveTab={setActiveTab}
            mobileOpen={true}
            setMobileOpen={setMobileOpen}
            user={{ name: "Ada Lovelace", isAdmin: true }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("GRACIA FAB")).toBeInTheDocument();
      expect(screen.getByText("ADMIN PORTAL")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /orders/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /inventory/i })).toBeInTheDocument();

      // Order Board and Bookings are live in stage 2/3
      expect(screen.getByRole("button", { name: /bookings/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /order board/i })).not.toBeDisabled();

      // Click Orders tab
      fireEvent.click(screen.getByRole("button", { name: /orders/i }));
      expect(setActiveTab).toHaveBeenCalledWith("orders");

      // Click Order Board tab
      const orderBoardBtn = screen.getByRole("button", { name: /order board/i });
      fireEvent.click(orderBoardBtn);
      expect(setActiveTab).toHaveBeenCalledWith("orderboard");
    });
  });

  describe("AdminHeader", () => {
    it("renders breadcrumbs, title, back to store button, and alerts", () => {
      const setMobileOpen = vi.fn();
      render(
        <MemoryRouter>
          <AdminHeader
            activeTab="orders"
            setMobileOpen={setMobileOpen}
            adminError="Network timeout"
            adminNotice="3 orders updated"
            user={{ name: "Ada" }}
          />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: /orders management/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back to store/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Network timeout");
      expect(screen.getByRole("status")).toHaveTextContent("3 orders updated");

      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
      expect(setMobileOpen).toHaveBeenCalledWith(true);
    });
  });

  describe("AdminOverview", () => {
    it("fetches and renders 30-day revenue, cards, status chips, and stock alerts", async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOverviewData,
      });

      const onFilterOrders = vi.fn();
      const setActiveTab = vi.fn();

      render(
        <AdminOverview
          onFilterOrders={onFilterOrders}
          setActiveTab={setActiveTab}
          formatPrice={formatPrice}
        />
      );

      // Loading state then data
      expect(await screen.findByText(/net store revenue/i)).toBeInTheDocument();
      expect(screen.getByText("₦125,000")).toBeInTheDocument();
      // Earlier period was 0, so must state "No orders last week", not an invented percentage
      expect(screen.getAllByText(/no orders last week/i).length).toBeGreaterThanOrEqual(1);

      // Check metric cards
      expect(screen.getByText(/average order value/i)).toBeInTheDocument();
      expect(screen.getAllByText("₦62,500").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/paid orders \(7 days\)/i)).toBeInTheDocument();
      expect(screen.getByText(/new customers \(7 days\)/i)).toBeInTheDocument();

      // Check status pipeline chips
      expect(screen.getByText("Pending Payment")).toBeInTheDocument();
      expect(screen.getByText("Processing & Packing")).toBeInTheDocument();

      // Clicking a status chip routes to filtered orders
      fireEvent.click(screen.getByText("Processing & Packing").closest("button"));
      expect(onFilterOrders).toHaveBeenCalledWith("processing");

      // Check stock alerts
      expect(screen.getByText(/1 Product\(s\) Out of Stock/i)).toBeInTheDocument();
      expect(screen.getByText(/Glowing Serum/i)).toBeInTheDocument();

      // Check recent orders
      expect(screen.getByText("Ngozi Obi")).toBeInTheDocument();
    });
  });

  describe("AdminOrders", () => {
    it("filters orders by search term and status tab", () => {
      render(
        <AdminOrders
          orders={mockOrdersList}
          formatPrice={formatPrice}
        />
      );

      expect(screen.getByText("Amaka Eze")).toBeInTheDocument();
      expect(screen.getByText("Chioma Kalu")).toBeInTheDocument();

      // Filter by search
      const searchInput = screen.getByLabelText(/search orders/i);
      fireEvent.change(searchInput, { target: { value: "Amaka" } });

      expect(screen.getByText("Amaka Eze")).toBeInTheDocument();
      expect(screen.queryByText("Chioma Kalu")).not.toBeInTheDocument();

      // Clear search
      fireEvent.click(screen.getByLabelText(/clear search/i));
      expect(screen.getByText("Chioma Kalu")).toBeInTheDocument();

      // Filter by Status Tab
      fireEvent.click(screen.getByRole("tab", { name: /pending/i }));
      expect(screen.queryByText("Amaka Eze")).not.toBeInTheDocument();
      expect(screen.getByText("Chioma Kalu")).toBeInTheDocument();
    });

    it("supports bulk selection and executes bulk status update", async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ updated: ["o111111111111111111111111"], failed: [] }),
      });

      const setAdminNotice = vi.fn();
      const setAdminError = vi.fn();
      const fetchOrders = vi.fn();

      render(
        <AdminOrders
          orders={mockOrdersList}
          fetchOrders={fetchOrders}
          formatPrice={formatPrice}
          setAdminNotice={setAdminNotice}
          setAdminError={setAdminError}
        />
      );

      // Select order o1
      const checkbox = screen.getByLabelText("Select order o111111111111111111111111");
      fireEvent.click(checkbox);

      // Bulk bar appears
      expect(screen.getByText(/1 order\(s\) selected/i)).toBeInTheDocument();

      // Click Mark Shipped
      fireEvent.click(screen.getByRole("button", { name: /mark shipped/i }));

      await waitFor(() => {
        expect(window.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/admin/orders/status"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ ids: ["o111111111111111111111111"], status: "shipped" }),
          })
        );
      });

      expect(setAdminNotice).toHaveBeenCalledWith("1 order(s) successfully marked shipped.");
    });

    it("opens inspect modal to review order address and line items", () => {
      render(
        <AdminOrders
          orders={mockOrdersList}
          formatPrice={formatPrice}
        />
      );

      fireEvent.click(screen.getByLabelText("Inspect order o111111111111111111111111"));
      expect(screen.getByRole("dialog", { name: /order details/i })).toBeInTheDocument();
      expect(screen.getByText(/12 Library Ave/i)).toBeInTheDocument();
      expect(screen.getByText(/08012345678/i)).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByLabelText(/close modal/i));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
