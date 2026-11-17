import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AdminDashboard from "../AdminDashboard";
import MyOrders from "../MyOrders";

let mockUser = { _id: "a1", name: "Admin", email: "admin@example.com", isAdmin: true };
// Must be the same function on every render (like the real AuthContext):
// AdminDashboard's data loader depends on it, so a new one each render
// would refetch forever.
const mockLogout = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout, loading: false }),
}));
vi.mock("../../components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("../../components/Footer", () => ({ default: () => <footer /> }));

const paidOrder = {
  _id: "o1aaaaaaaaaaaaaaaaaaaaa1",
  user: { name: "Ada", email: "ada@example.com" },
  orderItems: [{ name: "Wig", quantity: 1, image: "/x.png", price: 50000 }],
  totalPrice: 52500,
  isPaid: true,
  status: "processing",
  createdAt: "2026-11-17T10:00:00.000Z",
  refund: { status: "none" },
};

function wrap(ui) {
  return render(
    <HelmetProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </HelmetProvider>,
  );
}

describe("admin: cancel and refund", () => {
  let orders;
  beforeEach(() => {
    mockUser = { _id: "a1", name: "Admin", email: "admin@example.com", isAdmin: true };
    orders = [{ ...paidOrder }];
    window.fetch = vi.fn(async (url, opts = {}) => {
      if (url.endsWith("/cancel") && opts.method === "PUT") {
        orders = [{ ...paidOrder, status: "cancelled", refund: { status: "pending", amount: 52500 } }];
        return { ok: true, json: async () => orders[0] };
      }
      if (url.endsWith("/refund") && opts.method === "PUT") {
        orders = [{ ...orders[0], refund: { status: "refunded", amount: 52500, reference: "MNFY|R|1" } }];
        return { ok: true, json: async () => orders[0] };
      }
      if (url.includes("/api/admin/orders")) return { ok: true, json: async () => orders };
      if (url.includes("/api/admin/stats")) return { ok: true, json: async () => ({ totalOrders: 1, recentOrders: [] }) };
      return { ok: true, json: async () => [] };
    });
  });

  async function openOrdersTab() {
    wrap(<AdminDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: /orders/i }));
    return screen.findByLabelText(/update status for order/i);
  }

  it("cancels a paid order with a reason, then records the refund", async () => {
    const select = await openOrdersTab();
    window.prompt = vi.fn(() => "Customer changed their mind");

    fireEvent.change(select, { target: { value: "cancelled" } });

    await waitFor(() => {
      const call = window.fetch.mock.calls.find(([u, o]) => u.endsWith("/cancel") && o?.method === "PUT");
      expect(JSON.parse(call[1].body)).toEqual({ reason: "Customer changed their mind" });
    });
    expect(window.prompt.mock.calls[0][0]).toMatch(/refund of ₦52,500/);
    expect(await screen.findByText(/Refund recorded as due/)).toBeInTheDocument();
    expect(await screen.findByText(/Refund due ₦52,500/)).toBeInTheDocument();

    window.prompt = vi.fn(() => "MNFY|R|1");
    fireEvent.click(screen.getByRole("button", { name: /mark refunded/i }));
    await waitFor(() => {
      const call = window.fetch.mock.calls.find(([u, o]) => u.endsWith("/refund") && o?.method === "PUT");
      expect(JSON.parse(call[1].body)).toEqual({ reference: "MNFY|R|1" });
    });
    expect(await screen.findByText(/Refunded ✓/)).toBeInTheDocument();
  });

  it("does nothing if the admin dismisses the reason prompt", async () => {
    const select = await openOrdersTab();
    window.prompt = vi.fn(() => null);
    fireEvent.change(select, { target: { value: "cancelled" } });
    await waitFor(() => expect(window.prompt).toHaveBeenCalled());
    expect(window.fetch.mock.calls.some(([u]) => u.endsWith("/cancel"))).toBe(false);
  });

  it("shows the server's message when a change is refused", async () => {
    const select = await openOrdersTab();
    const base = window.fetch;
    window.fetch = vi.fn(async (url, opts = {}) =>
      opts.method === "PUT"
        ? { ok: false, json: async () => ({ message: 'Cannot change order from "processing" to "pending"' }) }
        : base(url, opts),
    );
    fireEvent.change(select, { target: { value: "pending" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Cannot change order/);
  });
});

describe("customer: My Orders refund note", () => {
  it("tells the customer their refund is on its way", async () => {
    mockUser = { _id: "u1", name: "Ada", email: "ada@example.com", isAdmin: false };
    localStorage.setItem("token", "t");
    window.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ ...paidOrder, user: "u1", status: "cancelled", refund: { status: "pending", amount: 52500 } }],
    }));
    wrap(<MyOrders />);
    expect(await screen.findByText(/Refund of ₦52,500 on its way/)).toBeInTheDocument();
  });
});
