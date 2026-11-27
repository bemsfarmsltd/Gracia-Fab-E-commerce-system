import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ProductDetail from "../ProductDetail";
import { CartProvider } from "../../context/CartContext";
import { ToastProvider } from "../../components/Toast";
import { AuthContext } from "../../hooks/useAuth";

const MOCK_PRODUCT = {
  _id: "prod-101",
  name: "Pure Glow Vitamin C Elixir",
  brand: "Radiant Skincare",
  price: 29900,
  originalPrice: 35000,
  rating: 4.8,
  numReviews: 24,
  category: "skincare",
  tags: ["vitamin c", "brightening", "radiance"],
  description: "Formulated with 15% pure L-Ascorbic Acid for luminous melanin radiance.",
  image: "https://example.com/vitc-bottle.jpg",
  isInStock: true,
  stock: 14,
};

const MOCK_REVIEWS = [
  {
    _id: "rev-1",
    name: "Amara Okonkwo",
    rating: 5,
    verified: true,
    skinType: "Oily",
    comment: "This cleared my stubborn dark marks completely!",
    helpful: 12,
  },
];

function renderProductDetail(props = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/products/prod-101"]}>
        <AuthContext.Provider value={{ user: { name: "Test User", email: "test@example.com" }, loading: false }}>
          <ToastProvider>
            <CartProvider>
              <Routes>
                <Route
                  path="/products/:id"
                  element={<ProductDetail onCartOpen={props.onCartOpen} />}
                />
              </Routes>
            </CartProvider>
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("ProductDetail (GLOWIFY Inspired Architecture)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn((url) => {
      if (url.includes("/api/products/prod-101")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_PRODUCT),
        });
      }
      if (url.includes("/api/products")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_PRODUCT]),
        });
      }
      if (url.includes("/api/reviews/prod-101")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_REVIEWS),
        });
      }
      if (url.includes("/api/vouchers/public")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { code: "GLOW05", discountLabel: "5% OFF", conditionLabel: "First order only" },
              { code: "BEAUTY20", discountLabel: "20% OFF", conditionLabel: "Min spend ₦25,000" },
            ]),
        });
      }
      if (url.includes("/api/track/view") || url.includes("/api/wishlist")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it("renders product title, brand eyebrow, price in Naira, and breadcrumbs", async () => {
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pure Glow Vitamin C Elixir");
    });

    expect(screen.getByText("Radiant Skincare")).toBeInTheDocument();
    expect(screen.getByText("₦29,900")).toBeInTheDocument();
    expect(screen.getByText("Save 15%")).toBeInTheDocument();
    expect(screen.getByText(/100% Authentic Maison Guarantee/i)).toBeInTheDocument();
  });

  it("shows no discount when the product has no real original price", async () => {
    const noDiscount = { ...MOCK_PRODUCT, originalPrice: undefined };
    const base = globalThis.fetch;
    globalThis.fetch = vi.fn((url) =>
      url.includes("/api/products/prod-101")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(noDiscount) })
        : base(url)
    );
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pure Glow Vitamin C Elixir");
    });
    expect(document.querySelector(".pdp-badge-discount, .pdp-save-pill, .pdp-original-price")).toBeNull();
    expect(screen.queryByText(/Save \d+%/)).not.toBeInTheDocument();
  });

  it("handles quantity stepper increment and decrement correctly", async () => {
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    const decreaseBtn = screen.getByRole("button", { name: /decrease quantity/i });
    const increaseBtn = screen.getByRole("button", { name: /increase quantity/i });

    // Initial quantity is 1, so decrease should be disabled
    expect(decreaseBtn).toBeDisabled();

    // Increment
    fireEvent.click(increaseBtn);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(decreaseBtn).not.toBeDisabled();

    // Decrement back to 1
    fireEvent.click(decreaseBtn);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(decreaseBtn).toBeDisabled();
  });

  it("adds product with custom quantity to bag and triggers onCartOpen", async () => {
    const onCartOpen = vi.fn();
    renderProductDetail({ onCartOpen });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    // Increase quantity to 2
    const increaseBtn = screen.getByRole("button", { name: /increase quantity/i });
    fireEvent.click(increaseBtn);

    // Click Add to Bag
    const addBagBtn = screen.getByRole("button", { name: /\+ Add to Bag/i });
    fireEvent.click(addBagBtn);

    expect(onCartOpen).toHaveBeenCalled();
  });

  it("describes the product from catalogue data only, with nothing invented", async () => {
    const withSuits = { ...MOCK_PRODUCT, suitableFor: { skinType: ["oily", "normal"], concern: ["dark spots"] } };
    const base = globalThis.fetch;
    globalThis.fetch = vi.fn((url) =>
      url.includes("/api/products/prod-101")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(withSuits) })
        : base(url)
    );
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    expect(screen.getByText(/About Pure Glow Vitamin C Elixir/i)).toBeInTheDocument();
    expect(screen.getByText("oily, normal")).toBeInTheDocument();
    expect(screen.getByText("dark spots")).toBeInTheDocument();
    // The old one-size-fits-all template: invented actives, sizes, steps, "clean" claims.
    for (const invented of [/Potent Active Ingredients/i, /Remy/i, /parabens/i, /mineral oils/i, /30 ml/i, /Step 01/i, /Routine Placement/i, /Melanin Barrier/i]) {
      expect(screen.queryByText(invented)).not.toBeInTheDocument();
    }
  });

  it("renders customer reviews hub with 5-star progress bars", async () => {
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByText("Customer Reviews")).toBeInTheDocument();
    });

    // Star bar labels
    expect(screen.getByText("5 Stars")).toBeInTheDocument();
    expect(screen.getByText("4 Stars")).toBeInTheDocument();

    // Verified review
    expect(screen.getByText("Amara Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("✓ Verified Buyer")).toBeInTheDocument();
    expect(screen.getByText(/This cleared my stubborn dark marks completely!/i)).toBeInTheDocument();
  });

  it("renders available vouchers with 1-click clipboard copy", async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByText(/Available Vouchers For You/i)).toBeInTheDocument();
    });

    expect(screen.getByText("GLOW05")).toBeInTheDocument();
    expect(screen.getByText("BEAUTY20")).toBeInTheDocument();

    // Click GLOW05 voucher
    const voucherCard = screen.getByText("GLOW05").closest(".pdp-voucher-card");
    fireEvent.click(voucherCard);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("GLOW05");
    expect(screen.getByText("Min spend ₦25,000")).toBeInTheDocument();
  });

  it("shows no voucher section when no vouchers are live", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn((url) =>
      url.includes("/api/vouchers/public")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        : original(url),
    );

    renderProductDetail();

    await screen.findAllByText(/Pure Glow Vitamin C Elixir/i);
    expect(screen.queryByText(/Available Vouchers For You/i)).not.toBeInTheDocument();
  });

  it("shows 'No reviews yet' instead of 5 stars when product has no reviews", async () => {
    const unreviewedProduct = {
      ...MOCK_PRODUCT,
      rating: 0,
      numReviews: 0,
    };
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn((url) => {
      if (url.includes("/api/products/prod-101")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unreviewedProduct),
        });
      }
      if (url.includes("/api/reviews/prod-101")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return original(url);
    });

    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    expect(screen.getAllByText("No reviews yet").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("4.8/5")).not.toBeInTheDocument();
  });

  it("renders Product structured data schema with price in NGN and stock availability", async () => {
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    // react-helmet-async writes the head tags after the page renders, so on a
    // slow machine (CI) the script can appear a moment after the heading.
    await waitFor(() => {
      expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    });
    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script.textContent);
    expect(parsed["@type"]).toBe("Product");
    expect(parsed.name).toBe("Pure Glow Vitamin C Elixir");
    expect(parsed.offers.priceCurrency).toBe("NGN");
    expect(parsed.offers.price).toBe(29900);
    expect(parsed.offers.availability).toBe("https://schema.org/InStock");
  });
});
