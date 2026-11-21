import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Home from "../Home";
import { CartProvider } from "../../context/CartContext";
import { ToastProvider } from "../../components/Toast";
import { BeautyProfileProvider } from "../../context/BeautyProfileContext";
import { AuthContext } from "../../hooks/useAuth";

// A small catalogue like the live one: real-looking products with stock,
// dates, brands and photos.
const P = (o) => ({ description: "A product we stock.", brand: "Brand", stock: 10, isInStock: true, suitableFor: {}, ...o });
const CATALOG = [
  P({ _id: "w1", name: "Body Wave Lace Wig", category: "wig", price: 85000, image: "https://res.cloudinary.com/x/wig.jpg", createdAt: "2026-11-10", description: "Body wave lace closure wig." }),
  P({ _id: "s1", name: "Glowing Serum 2% Vitamin C", category: "skincare", price: 8500, image: "https://res.cloudinary.com/x/serum.jpg", createdAt: "2026-11-12", stock: 3, suitableFor: { skinType: ["dry", "normal"] } }),
  P({ _id: "s2", name: "Shea Body Lotion", category: "skincare", price: 6000, image: "/images/products/lotion.jpg", createdAt: "2026-11-01", suitableFor: { skinType: ["all"] } }),
  P({ _id: "h1", name: "Curl Defining Cream", category: "haircare", price: 7800, image: "https://res.cloudinary.com/x/curl.jpg", createdAt: "2026-10-01" }),
  P({ _id: "b1", name: "Bridal Glow Kit", category: "bridal", price: 38000, image: "https://res.cloudinary.com/x/bridal.jpg", createdAt: "2026-09-01", stock: 0, isInStock: false }),
];

let VOUCHERS = [{ code: "GLOW05", discountLabel: "30% OFF", conditionLabel: "Min spend ₦30,000 · Ends 10 Dec 2026" }];

function renderHome(props = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null, loading: false }}>
          <ToastProvider>
            <CartProvider>
              <BeautyProfileProvider>
                <Home {...props} />
              </BeautyProfileProvider>
            </CartProvider>
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("Home page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // The catalogue, and one live voucher (as set up in Admin → Vouchers).
    const mockFetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes("/api/vouchers/public") ? VOUCHERS : CATALOG),
    }));
    globalThis.fetch = mockFetch;
    window.fetch = mockFetch;
    navigator.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) };
    // jsdom has no video playback; the hero video calls play().catch(...).
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it("keeps the hero and its actions", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: /beauty, matched to you/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop the collection/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /consult ai advisor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /live undertone scan/i })).toBeInTheDocument();
  });

  it("shows real products from the catalogue in New in Store, in stock first", async () => {
    const onCartOpen = vi.fn();
    renderHome({ onCartOpen });

    const section = await screen.findByRole("region", { name: /new in store and featured product/i });
    // Newest in-stock first (the wig is featured separately), sold-out last.
    const names = within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names.slice(0, 4)).toEqual(["Glowing Serum 2% Vitamin C", "Shea Body Lotion", "Curl Defining Cream", "Bridal Glow Kit"]);
    expect(within(section).getByText("In stock · only 3 left")).toBeInTheDocument();
    expect(within(section).getByText("Out of stock")).toBeInTheDocument();
    // Sold-out products can't be added; in-stock ones can.
    expect(within(section).queryByRole("button", { name: "Add Bridal Glow Kit to bag" })).not.toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Add Shea Body Lotion to bag" }));
    expect(onCartOpen).toHaveBeenCalled();
  });

  it("features a real in-stock product with no invented discount or reviews", async () => {
    renderHome();
    const section = await screen.findByRole("region", { name: /new in store and featured product/i });
    expect(within(section).getByText("Body wave lace closure wig.")).toBeInTheDocument();
    expect(within(section).getByText("₦85,000")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /see product details/i })).toHaveAttribute("href", "/products/w1");
    expect(screen.queryByText(/save ₦|verified reviews|★/i)).not.toBeInTheDocument();
  });

  it("uses real product photos for the category tiles and cards", async () => {
    renderHome();
    await screen.findByRole("region", { name: /new in store and featured product/i });
    const imgs = screen.getAllByRole("img").map((i) => i.getAttribute("src"));
    expect(imgs).toContain("https://res.cloudinary.com/x/wig.jpg");
    expect(imgs).toContain("https://res.cloudinary.com/x/curl.jpg");
    // Bridal is sold out but still has a real photo.
    expect(imgs).toContain("https://res.cloudinary.com/x/bridal.jpg");
    expect(imgs.some((src) => /unsplash/.test(src || ""))).toBe(false);
  });

  it("compares two real skincare products", async () => {
    renderHome();
    const table = await screen.findByLabelText(/example comparison of two products we stock/i);
    expect(within(table).getByText("Glowing Serum 2% Vitamin C")).toBeInTheDocument();
    expect(within(table).getByText("Shea Body Lotion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compare products/i })).toHaveAttribute("href", "/compare");
  });

  it("shows the real voucher, delivery and loyalty points, and no invented claims", async () => {
    renderHome();
    await screen.findByRole("region", { name: /new in store and featured product/i });
    expect(await screen.findByText("GLOW05", { selector: ".coupon-code" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "30% OFF with code GLOW05" })).toBeInTheDocument();
    expect(screen.getByText(/Min spend ₦30,000 · Ends 10 Dec 2026. Enter the code at checkout./)).toBeInTheDocument();
    expect(screen.queryByText("BEAUTY20")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /flat ₦2,500 delivery nationwide/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /earn points on every order/i })).toBeInTheDocument();
    expect(screen.getByText(/100 points takes ₦500 off/i)).toBeInTheDocument();
    for (const claim of [/single-donor/i, /white cast/i, /privé/i, /purity guarantee/i, /accuracy guarantee/i, /matched foundation/i, /14-day/i, /cash back/i]) {
      expect(screen.queryByText(claim)).not.toBeInTheDocument();
    }
  });

  it("explains undertones and opens the camera scan", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: /find your undertone/i })).toBeInTheDocument();
    expect(screen.getAllByText("Warm Golden").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /launch live undertone camera/i }));
    expect(screen.getByText(/african melanin & undertone analysis/i)).toBeInTheDocument();
  });

  it("still renders the page if the catalogue can't load", async () => {
    window.fetch = globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    renderHome();
    expect(screen.getByRole("heading", { name: /beauty, matched to you/i })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("region", { name: /new in store/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("img").every((i) => !/unsplash/.test(i.getAttribute("src") || ""))).toBe(true);
  });

  it("doesn't advertise a voucher code when none is live", async () => {
    VOUCHERS = [];
    renderHome();
    expect(await screen.findByRole("heading", { name: /delivered anywhere in nigeria for ₦2,500/i })).toBeInTheDocument();
    expect(document.querySelector(".coupon-code")).toBeNull();
    VOUCHERS = [{ code: "GLOW05", discountLabel: "30% OFF", conditionLabel: "Min spend ₦30,000 · Ends 10 Dec 2026" }];
  });
});
