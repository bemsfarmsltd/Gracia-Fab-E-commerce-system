import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesPanel from "../SalesPanel";

const report = (months) => ({
  months: Array.from({ length: months }, (_, i) => ({
    month: `2026-${String(12 - months + i).padStart(2, "0")}`,
    revenue: i === months - 1 ? 90000 : 0,
    orders: i === months - 1 ? 2 : 0,
    itemsSold: i === months - 1 ? 4 : 0,
    discounts: i === months - 1 ? 5000 : 0,
    delivery: i === months - 1 ? 5000 : 0,
    averageOrder: i === months - 1 ? 45000 : 0,
  })),
  totals: { revenue: 90000, orders: 2, itemsSold: 4, discounts: 5000, delivery: 5000, averageOrder: 45000 },
  topProducts: [{ productId: "p1", name: "Glow Serum", units: 3, orders: 2, sales: 30000 }],
});

describe("SalesPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.fetch = vi.fn(async (url) => {
      if (String(url).includes("/orders/export")) {
        return {
          ok: true,
          headers: { get: () => 'attachment; filename="gracia-fab-orders-from-2026-11-01-to-2026-11-17.csv"' },
          blob: async () => new Blob(["Order ID\r\n"]),
        };
      }
      const months = Number(new URL(url).searchParams.get("months"));
      return { ok: true, json: async () => report(months) };
    });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    // jsdom can't follow the download link; the click itself is what matters.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("shows totals, monthly rows and best sellers", async () => {
    render(<SalesPanel />);

    expect(await screen.findByText("Glow Serum")).toBeInTheDocument();
    expect(screen.getByText("Revenue (6 months)")).toBeInTheDocument();
    expect(screen.getAllByText(/₦\s?90,000/).length).toBeGreaterThan(0);
    // 6 months, newest first.
    const monthTable = screen.getAllByRole("table")[0];
    const rows = within(monthTable).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent("Nov 2026");
  });

  it("reloads for a different period", async () => {
    render(<SalesPanel />);
    await screen.findByText("Glow Serum");

    fireEvent.click(screen.getByRole("button", { name: "12 months" }));

    await waitFor(() => expect(window.fetch).toHaveBeenLastCalledWith(expect.stringContaining("months=12"), expect.anything()));
    expect(await screen.findByText("Revenue (12 months)")).toBeInTheDocument();
  });

  it("downloads the orders spreadsheet for the chosen dates", async () => {
    render(<SalesPanel />);
    await screen.findByText("Glow Serum");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-17" } });
    fireEvent.click(screen.getByRole("button", { name: /download orders/i }));

    expect(await screen.findByText(/Downloaded gracia-fab-orders-from-2026-11-01-to-2026-11-17\.csv/)).toBeInTheDocument();
    const [url, opts] = window.fetch.mock.calls.find(([u]) => String(u).includes("/orders/export"));
    expect(url).toContain("from=2026-11-01&to=2026-11-17");
    expect(opts.headers.Authorization).toMatch(/^Bearer /);
  });
});
