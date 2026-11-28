import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import AdminCategories from "../AdminCategories";

const tree = () => [
  {
    _id: "d1", slug: "skincare", name: "Skincare", active: true, productCount: 3, unsortedCount: 2,
    children: [
      { _id: "c1", slug: "serums", name: "Serums", active: true, productCount: 1 },
      { _id: "c2", slug: "toners", name: "Toners", active: false, productCount: 0 },
    ],
  },
  {
    _id: "d2", slug: "bodycare", name: "Body care", active: true, productCount: 0, unsortedCount: 0,
    children: [{ _id: "c3", slug: "bar-soaps", name: "Bar soaps", active: true, productCount: 0 }],
  },
];
const products = [
  { _id: "p1", name: "Black Soap", category: "skincare", subcategory: null },
  { _id: "p2", name: "Glow Serum", category: "skincare", subcategory: "serums" },
  { _id: "p3", name: "Sulphur Soap", category: "skincare", subcategory: null },
];

let calls;
beforeEach(() => {
  calls = [];
  window.fetch = vi.fn(async (url, opts = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    if (path === "/api/admin/categories" && !opts.method) return { ok: true, json: async () => tree() };
    if (path === "/api/admin/products") return { ok: true, json: async () => products };
    if (path === "/api/admin/categories" && opts.method === "POST") return { ok: true, json: async () => ({ slug: "lip-care" }) };
    if (path === "/api/admin/categories/assign") return { ok: true, json: async () => ({ updated: 2 }) };
    return { ok: true, json: async () => ({}) };
  });
});

describe("AdminCategories", () => {
  it("lists departments with their categories, counts and hidden ones", async () => {
    render(<AdminCategories />);
    const skincare = await screen.findByRole("region", { name: "Skincare" });
    expect(within(skincare).getByText("Serums")).toBeInTheDocument();
    expect(within(skincare).getByText("3 products")).toBeInTheDocument();
    expect(within(skincare).getByText("Hidden from the shop")).toBeInTheDocument();
    expect(within(skincare).getByText(/2 products here have no category yet/)).toBeInTheDocument();
    // A category in use can't be deleted; an empty one can.
    const serumsRow = within(skincare).getByText("Serums").closest(".cats-row");
    expect(within(serumsRow).getByRole("button", { name: "Delete" })).toBeDisabled();
    const tonersRow = within(skincare).getByText("Toners").closest(".cats-row");
    expect(within(tonersRow).getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(within(tonersRow).getByRole("button", { name: "Show" })).toBeInTheDocument();
  });

  it("adds a category to a department and reorders", async () => {
    const notice = vi.fn();
    render(<AdminCategories setAdminNotice={notice} />);
    const skincare = await screen.findByRole("region", { name: "Skincare" });
    fireEvent.change(within(skincare).getByLabelText("New category in Skincare"), { target: { value: "Lip care" } });
    fireEvent.click(within(skincare).getByRole("button", { name: "Add category" }));
    await waitFor(() => expect(notice).toHaveBeenCalledWith('Added "Lip care"'));
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/admin/categories").body).toEqual({ name: "Lip care", parent: "skincare" });

    fireEvent.click(within(skincare).getByRole("button", { name: "Move Serums down" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/categories/reorder")).toBe(true));
    expect(calls.find((c) => c.path === "/api/admin/categories/reorder").body).toEqual({ ids: ["c2", "c1"] });
  });

  it("sorts ticked products into a category", async () => {
    const notice = vi.fn();
    render(<AdminCategories setAdminNotice={notice} />);
    // Only products with no category yet, by default.
    expect(await screen.findByText("Black Soap")).toBeInTheDocument();
    expect(screen.queryByText("Glow Serum")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Tick all 2 shown/));
    fireEvent.change(screen.getByLabelText("Put ticked products in"), { target: { value: "bar-soaps" } });
    fireEvent.click(screen.getByRole("button", { name: "Put 2 products in this category" }));

    await waitFor(() => expect(notice).toHaveBeenCalledWith('Put 2 products in "Bar soaps"'));
    expect(calls.find((c) => c.path === "/api/admin/categories/assign").body).toEqual({ productIds: ["p1", "p3"], subcategory: "bar-soaps" });
  });
});
