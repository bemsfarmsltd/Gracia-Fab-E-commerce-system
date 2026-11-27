import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminSuppliers from "../AdminSuppliers";
import AdminSidebar from "../AdminSidebar";
import { MemoryRouter } from "react-router-dom";

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const COSTING = {
  products: [
    { _id: "p1", name: "Shea Body Butter", price: 7500, stock: 20, costPrice: 4500, lastCost: 5000, margin: 40, stockValue: 90000, supplier: { _id: "s1", name: "Lagos Wholesale" }, reorderLevel: 5, needsReorder: false },
    { _id: "p2", name: "Hair Oil", price: 4000, stock: 3, costPrice: null, lastCost: null, margin: null, stockValue: null, supplier: null, reorderLevel: 4, needsReorder: true },
  ],
  totals: { stockValue: 90000, retailValue: 162000, withoutCost: 1 },
};
const PROFIT = {
  products: [{ product: "p1", name: "Shea Body Butter", units: 3, onlineUnits: 1, shopUnits: 2, revenue: 22500, cost: 12000, profit: 10500, margin: 46.7, unitsWithoutCost: 0 }],
  totals: { units: 4, revenue: 26500, discounts: 500, netRevenue: 26000, cost: 12000, profit: 14000, margin: 53.8, unitsWithoutCost: 1 },
};

function mockApi() {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
    const method = opts.method || "GET";
    calls.push([method, url.replace(/^.*\/api/, "/api"), opts.body ? JSON.parse(opts.body) : undefined]);
    if (url.includes("/costing/products/") && method === "PUT") return json(200, {});
    if (url.includes("/costing/products")) return json(200, COSTING);
    if (url.includes("/costing/reorder")) return json(200, { groups: [{ supplier: null, products: [{ _id: "p2", name: "Hair Oil", stock: 3, reorderLevel: 4, lastCost: null }] }] });
    if (url.includes("/suppliers")) return json(200, [{ _id: "s1", name: "Lagos Wholesale", products: 1 }]);
    if (url.includes("/purchases") && method === "POST") return json(201, { supplierName: "Lagos Wholesale", items: [{}], total: 20000 });
    if (url.includes("/reports/profit")) return json(200, PROFIT);
    return json(404, {});
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("suppliers and costs", () => {
  it("shows stock value, flags missing costs and saves a cost", async () => {
    const calls = mockApi();
    render(<AdminSuppliers setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByText("₦90,000", { selector: "strong" });
    expect(screen.getByText("1 product(s) in stock have no cost yet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "To reorder (1)" })).toBeInTheDocument();
    const cost = screen.getByLabelText("Cost of Hair Oil");
    fireEvent.change(cost, { target: { value: "2500" } });
    fireEvent.blur(cost);
    await waitFor(() => expect(calls.some(([m, u, b]) => m === "PUT" && u.endsWith("/costing/products/p2") && b.costPrice === 2500)).toBe(true));
  });

  it("records a delivery with quantities and unit costs", async () => {
    const calls = mockApi();
    const setAdminNotice = vi.fn();
    render(<AdminSuppliers setAdminError={vi.fn()} setAdminNotice={setAdminNotice} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Record a delivery" }));
    fireEvent.change(screen.getByLabelText("Supplier"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Add a product"), { target: { value: "shea" } });
    fireEvent.click(screen.getByRole("button", { name: "Shea Body Butter" }));
    expect(screen.getByLabelText("Unit cost of Shea Body Butter").value).toBe("5000"); // last cost suggested
    fireEvent.change(screen.getByLabelText("Quantity of Shea Body Butter"), { target: { value: "4" } });
    expect(screen.getByText("₦20,000", { selector: "strong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record delivery" }));
    await waitFor(() => expect(setAdminNotice).toHaveBeenCalledWith(expect.stringMatching(/Delivery from Lagos Wholesale recorded/)));
    expect(calls.find(([m, u]) => m === "POST" && u.endsWith("/purchases"))[2]).toEqual({ supplierId: "s1", items: [{ productId: "p1", quantity: 4, unitCost: 5000 }] });
  });

  it("shows profit after discounts and warns when costs are missing", async () => {
    mockApi();
    render(<AdminSuppliers setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Profit" }));
    await screen.findByText("₦14,000", { selector: "strong" });
    expect(screen.getByText(/1 unit\(s\) sold had no cost entered/)).toBeInTheDocument();
    expect(screen.getByText("3 (1 / 2)")).toBeInTheDocument();
  });

  it("is in the owner's menu only", () => {
    const { rerender } = render(<MemoryRouter><AdminSidebar activeTab="overview" setActiveTab={vi.fn()} mobileOpen={false} setMobileOpen={vi.fn()} user={{ isAdmin: true }} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Suppliers & Costs/ })).toBeInTheDocument();
    rerender(<MemoryRouter><AdminSidebar activeTab="orderboard" setActiveTab={vi.fn()} mobileOpen={false} setMobileOpen={vi.fn()} user={{ role: "staff", permissions: ["orders.view", "stock.count", "store.sell"] }} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /Suppliers & Costs/ })).toBeNull();
  });
});
