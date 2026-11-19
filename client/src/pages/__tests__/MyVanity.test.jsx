import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import MyVanity from "../MyVanity";
import { greeting, profileFromDevice } from "../../utils/vanity";
import { CartProvider } from "../../context/CartContext";
import { ToastProvider } from "../../components/Toast";
import { BeautyProfileProvider } from "../../context/BeautyProfileContext";
import { AuthContext } from "../../hooks/useAuth";

const options = {
  skinTypes: ["oily", "dry", "combination", "normal", "sensitive"],
  hairTypes: ["straight", "wavy", "curly", "coily"],
  shoppingFor: ["skincare", "haircare", "wig", "bridal"],
  budgets: ["budget", "moderate", "premium"],
  skinConcerns: [{ id: "dark-spots", label: "Dark spots & uneven tone" }, { id: "dryness", label: "Dryness & flaking" }],
  hairConcerns: [{ id: "breakage", label: "Breakage & thinning" }],
};
const emptyProfile = { skinType: null, hairType: null, skinConcerns: [], hairConcerns: [], shoppingFor: [], budget: null, undertone: null };
const product = (o) => ({ _id: o.name, brand: "Test", price: 8000, image: "", inStock: true, lowStock: false, ...o });

const vanity = (over = {}) => ({
  firstName: "Adaeze",
  profile: { ...emptyProfile, skinType: "dry", skinConcerns: ["dark-spots"] },
  completeness: { done: 2, total: 5, missing: [] },
  options,
  picks: { basis: "profile", items: [product({ name: "Glow Serum", reasons: ["Suits dry skin", "Targets dark spots & uneven tone"] })] },
  activeOrders: [{ _id: "abc123def456", status: "shipped", isPaid: true, totalPrice: 20500, itemCount: 2 }],
  restock: [],
  wishlist: { count: 0, items: [] },
  recentlyViewed: [],
  savedRoutine: null,
  loyalty: { points: 120, tier: "bronze", totalEarned: 120, nextTier: "silver", pointsToNext: 380, nextTierAt: 500 },
  ...over,
});

function renderVanity() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { name: "Adaeze Okafor" }, loading: false, logout: vi.fn() }}>
          <ToastProvider>
            <BeautyProfileProvider>
              <CartProvider>
                <MyVanity onCartOpen={vi.fn()} />
              </CartProvider>
            </BeautyProfileProvider>
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("My Vanity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "t");
  });

  it("greets the customer and shows their profile, picks with reasons, orders and rewards", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({ ok: true, json: async () => vanity() });
    renderVanity();

    expect(await screen.findByRole("heading", { level: 1, name: /, Adaeze$/ })).toBeInTheDocument();
    expect(screen.getByText("Dark spots & uneven tone")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Picked for you" })).toBeInTheDocument();
    expect(screen.getByText("Suits dry skin · Targets dark spots & uneven tone")).toBeInTheDocument();
    expect(screen.getByText("On its way", { selector: "li" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("380 points to Silver")).toBeInTheDocument();
    expect(window.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/vanity"), expect.objectContaining({ headers: { Authorization: "Bearer t" } }));
  });

  it("labels picks honestly as new when there's no profile yet", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => vanity({ profile: emptyProfile, completeness: { done: 0, total: 5, missing: [] }, picks: { basis: "new", items: [product({ name: "New Toner", reasons: ["New in store"] })] }, activeOrders: [] }),
    });
    renderVanity();
    expect(await screen.findByRole("heading", { name: "New in store" })).toBeInTheDocument();
    expect(screen.queryByText("Picked for you")).not.toBeInTheDocument();
  });

  it("asks before adding answers from the AI tools on this device, then saves them", async () => {
    localStorage.setItem("beautyProfile", JSON.stringify({ skinType: "oily", skinConcerns: "Acne & Breakouts, Dark Spots", shoppingFor: "skincare" }));
    const fetchMock = vi.spyOn(window, "fetch").mockImplementation(async (url, opts = {}) => {
      if (opts.method === "PUT") return { ok: true, json: async () => ({}) };
      return { ok: true, json: async () => vanity({ profile: emptyProfile, completeness: { done: 0, total: 5, missing: [] } }) };
    });
    renderVanity();

    fireEvent.click(await screen.findByRole("button", { name: "Add them" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(true));
    const [, put] = fetchMock.mock.calls.find(([, o]) => o?.method === "PUT");
    expect(JSON.parse(put.body)).toEqual({ skinType: "oily", skinConcerns: ["dark-spots", "acne"], shoppingFor: ["skincare"] });
    expect(localStorage.getItem("vanityImportDismissed")).toBe("1");
  });

  it("shows a retry when the page can't load", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({ ok: false, json: async () => ({ message: "Not authorized" }) });
    renderVanity();
    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("My Vanity helpers", () => {
  it("greets by Nigerian time", () => {
    expect(greeting(new Date("2026-11-19T06:00:00Z"))).toBe("Good morning"); // 07:00 WAT
    expect(greeting(new Date("2026-11-19T12:00:00Z"))).toBe("Good afternoon"); // 13:00 WAT
    expect(greeting(new Date("2026-11-19T17:30:00Z"))).toBe("Good evening"); // 18:30 WAT
  });

  it("maps device answers onto profile choices and drops what doesn't fit", () => {
    expect(profileFromDevice({ skinType: "dry", hairType: "kinky", shoppingFor: "everything", budget: "Moderate (₦5k–₦15k)", skinTone: { label: "Warm Golden / Caramel" } }, options))
      .toEqual({ skinType: "dry", shoppingFor: ["skincare", "haircare", "wig", "bridal"], budget: "moderate", undertone: "Warm Golden / Caramel" });
    expect(profileFromDevice({}, options)).toEqual({});
  });
});
