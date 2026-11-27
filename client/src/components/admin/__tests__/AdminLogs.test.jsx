import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminStockHistory from "../AdminStockHistory";
import AdminActivity from "../AdminActivity";

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const now = new Date().toISOString();
const PRODUCTS = [{ _id: "p1", name: "Shea Body Butter", sku: "GF-000001", stock: 7 }, { _id: "p2", name: "Hair Oil", stock: 3 }];
const MOVES = {
  items: [
    { _id: "m2", product: "p1", productName: "Shea Body Butter", change: -2, balanceAfter: 7, reason: "store_sale", reasonLabel: "Sold in the shop", actorName: "Chioma", note: "S-000004", createdAt: now },
    { _id: "m1", product: "p1", productName: "Shea Body Butter", change: 9, balanceAfter: 9, reason: "received", reasonLabel: "Received (delivery from a supplier)", actorName: "Gracia MD", createdAt: now },
  ],
  total: 2, page: 1, pages: 1,
  reasons: { received: "Received (delivery from a supplier)", store_sale: "Sold in the shop", damaged: "Damaged" },
};

function mockStock({ reconciliation } = {}) {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
    const method = opts.method || "GET";
    calls.push([method, url.replace(/^.*\/api/, "/api"), opts.body ? JSON.parse(opts.body) : undefined]);
    if (url.includes("/api/admin/products")) return json(200, PRODUCTS);
    if (url.includes("/stock/summary")) return json(200, { byReason: [{ reason: "store_sale", units: -2 }, { reason: "online_sale", units: -3 }, { reason: "received", units: 9 }, { reason: "damaged", units: -1 }] });
    if (url.includes("/stock/movements") && method === "POST") return json(201, { stock: 4, movement: { reasonLabel: "Damaged" } });
    if (url.includes("/stock/movements")) return json(200, url.includes("product=") ? { ...MOVES, reconciliation } : MOVES);
    return json(404, {});
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("stock history", () => {
  it("shows the shop-wide totals and movements, and opens one product", async () => {
    const calls = mockStock({ reconciliation: { stock: 7, movementsTotal: 7, matches: true } });
    render(<AdminStockHistory setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByText("Sold in the shop", { selector: ".logs-stat-label" });
    expect(screen.getByText("Sold online").nextSibling.textContent).toBe("-3");
    expect(screen.getByText("Received and returned").nextSibling.textContent).toBe("+9");
    expect(screen.getByText("Written off").nextSibling.textContent).toBe("-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Shea Body Butter" })[0]);
    await screen.findByText("✓ Every change is accounted for");
    expect(screen.getByText("7", { selector: ".logs-big" })).toBeInTheDocument();
    expect(calls.some(([, u]) => u.includes("product=p1"))).toBe(true);
  });

  it("opens straight on a product from Inventory and records a write-off", async () => {
    const calls = mockStock({ reconciliation: { stock: 7, movementsTotal: 7, matches: true } });
    const setAdminNotice = vi.fn();
    render(<AdminStockHistory productId="p1" setAdminError={vi.fn()} setAdminNotice={setAdminNotice} />);
    await screen.findByText("History of Shea Body Butter", { exact: false });
    fireEvent.change(screen.getByLabelText("What happened"), { target: { value: "damaged" } });
    fireEvent.change(screen.getByLabelText("How many"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Take off 3" }));
    await waitFor(() => expect(setAdminNotice).toHaveBeenCalledWith("Damaged: Shea Body Butter now has 4 in stock."));
    expect(calls.find(([m, u]) => m === "POST" && u.endsWith("/stock/movements"))[2]).toEqual({ productId: "p1", reason: "damaged", quantity: 3 });
  });

  it("warns when a product's history doesn't add up", async () => {
    mockStock({ reconciliation: { stock: 50, movementsTotal: 9, matches: false } });
    render(<AdminStockHistory productId="p1" setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/adds up to 9, but the count says 50/);
  });
});

describe("activity log", () => {
  it("groups changes by day, filters by area and person, and shows before → after", async () => {
    const calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      calls.push(url.replace(/^.*\/api/, "/api"));
      if (url.includes("/api/admin/staff")) return json(200, { people: [{ _id: "u1", name: "Gracia MD", role: "owner" }, { _id: "u2", name: "Chioma", role: "staff" }] });
      return json(200, {
        items: [{ _id: "a1", actorName: "Gracia MD", action: "product.update", summary: '"Shea Body Butter": price ₦7,500 → ₦8,000', changes: { price: { from: 7500, to: 8000 } }, createdAt: now }],
        total: 1, page: 1, pages: 1,
      });
    });
    render(<AdminActivity setAdminError={vi.fn()} />);
    await screen.findByText('"Shea Body Butter": price ₦7,500 → ₦8,000');
    expect(screen.getByText("Today")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText("7500")).toHaveClass("logs-from");
    expect(screen.getByText("8000")).toHaveClass("logs-to");

    fireEvent.click(screen.getByRole("button", { name: "Stock" }));
    await waitFor(() => expect(calls.some((u) => u.includes("action=stock"))).toBe(true));
    fireEvent.change(await screen.findByLabelText("Who"), { target: { value: "u2" } });
    await waitFor(() => expect(calls.some((u) => u.includes("actor=u2"))).toBe(true));
  });
});
