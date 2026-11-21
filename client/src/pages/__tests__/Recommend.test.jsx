import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Recommend from "../Recommend";
import { CartProvider } from "../../context/CartContext";
import { ToastProvider } from "../../components/Toast";
import { BeautyProfileProvider } from "../../context/BeautyProfileContext";
import { AuthContext } from "../../hooks/useAuth";
import { buildRecommendRequest } from "../../utils/recommend";

// What the server's /api/recommend returns: real catalogue products with a reason and tip.
const MATCHES = {
  success: true,
  source: "groq-ai",
  recommendations: [
    { product: { _id: "p1", name: "Glowing Serum 2% Vitamin C", brand: "Beauty Formulas", price: 8500, stock: 4, image: "https://res.cloudinary.com/x/serum.jpg" }, reason: "Suited to oily skin. Its listing mentions dark spots.", tip: "Apply on cleansed skin." },
    { product: { _id: "p2", name: "Shea Body Lotion", brand: "Karis", price: 6000, stock: 20, image: "/images/products/lotion.jpg" }, reason: "Suits all skin types.", tip: "Use after bathing." },
    { product: { _id: "p3", name: "Sold Out Toner", brand: "X", price: 5000, stock: 0, isInStock: false, image: "" }, reason: "Its listing mentions large pores.", tip: "-" },
  ],
};
const mockFetch = (handler) => {
  const fn = vi.fn(handler);
  globalThis.fetch = fn;
  window.fetch = fn;
  return fn;
};

function renderRecommend(props = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null, loading: false }}>
          <ToastProvider>
            <CartProvider>
              <BeautyProfileProvider>
                <Recommend {...props} />
              </BeautyProfileProvider>
            </CartProvider>
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("Recommend (AI Beauty Advisor Page)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the flagship hero section and value props", () => {
    renderRecommend();

    expect(
      screen.getByRole("heading", { name: /your personal beauty expert/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start your beauty consultation/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Personalized")).toBeInTheDocument();
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Expert Beauty Advice")).toBeInTheDocument();
  });

  it("renders the 4 interactive intent action tiles", () => {
    renderRecommend();

    expect(screen.getByText(/find the right skincare/i)).toBeInTheDocument();
    expect(screen.getByText(/get a makeup/i)).toBeInTheDocument();
    expect(screen.getByText(/build a complete/i)).toBeInTheDocument();
    expect(screen.getByText(/explore haircare/i)).toBeInTheDocument();
  });

  it("shows the products the server matched, with why and a tip, and adds them to the bag", async () => {
    mockFetch(async () => ({ ok: true, json: async () => MATCHES }));
    const onCartOpen = vi.fn();
    renderRecommend({ onCartOpen, initialStep: 5 });

    expect(await screen.findByText("Glowing Serum 2% Vitamin C")).toBeInTheDocument();
    expect(screen.getByText("Suited to oily skin. Its listing mentions dark spots.")).toBeInTheDocument();
    expect(screen.getByText("Apply on cleansed skin.")).toBeInTheDocument();
    expect(screen.getByText("₦8,500")).toBeInTheDocument();
    expect(screen.getByText("In stock · only 4 left")).toBeInTheDocument();
    // No invented ratings.
    expect(screen.queryByText(/★|1\.2k/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /add to cart ↗/i })[0]);
    expect(onCartOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/added "glowing serum 2% vitamin c" to your bag/i)).toBeInTheDocument();
  });

  it("won't add out-of-stock matches, and 'add all' adds only what's in stock", async () => {
    mockFetch(async () => ({ ok: true, json: async () => MATCHES }));
    const onCartOpen = vi.fn();
    renderRecommend({ onCartOpen, initialStep: 5 });

    expect(await screen.findByRole("button", { name: "Out of stock" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: /add all in stock/i })[0]);
    expect(onCartOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/added 2 matched products \(₦14,500\)/i)).toBeInTheDocument();
  });

  it("offers to try again when matching fails, and never shows invented products", async () => {
    let fail = true;
    const fn = mockFetch(async () => (fail ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => MATCHES }));
    renderRecommend({ initialStep: 5 });

    expect(await screen.findByText(/couldn't get your matches/i)).toBeInTheDocument();
    expect(screen.queryByText(/hydrating face cleanser/i)).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shea Body Lotion")).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("sends the customer's answers when they reach the results", async () => {
    const fn = mockFetch(async () => ({ ok: true, json: async () => MATCHES }));
    navigator.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) };
    renderRecommend({ initialStep: 4 });

    fireEvent.click(screen.getByRole("button", { name: /reveal my custom ritual/i }));
    await waitFor(() => expect(fn).toHaveBeenCalledWith(expect.stringContaining("/api/recommend"), expect.objectContaining({ method: "POST" })));
    const body = JSON.parse(fn.mock.calls[0][1].body);
    expect(body.lookingFor).toBe("skincare");
    expect(body.skinType).toBeTruthy();
    expect(body.skinConcerns).toMatch(/undertone/);
    expect(await screen.findByText("Glowing Serum 2% Vitamin C")).toBeInTheDocument();
  });

  it("maps answers onto the catalogue's terms", () => {
    expect(buildRecommendRequest({
      goal: "makeup", skinType: "Oily / Acne-Prone", hairType: "4C Coily & Tight Curls",
      concerns: ["Hyperpigmentation & Dark Spots", "Edge Protection & Lace Tension"], toneName: "Warm Golden",
    })).toEqual({
      lookingFor: "bridal", skinType: "Oily / Acne-Prone", hairType: "4C Coily & Tight Curls",
      skinConcerns: "Hyperpigmentation & Dark Spots, Warm Golden undertone",
      hairConcerns: "Edge Protection & Lace Tension", budget: "", occasion: "",
    });
  });

  it("renders the Live African Undertone banner and opens the camera detector modal", () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    };

    renderRecommend({ initialStep: 4 });

    // Check quickbanner
    expect(screen.getByText("Live African Undertone Detection")).toBeInTheDocument();
    expect(screen.getAllByText(/Warm Golden/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rich Neutral/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deep Espresso/i).length).toBeGreaterThan(0);

    // Click snap selfie button to open modal
    const snapBtn = screen.getByRole("button", {
      name: /📸 snap undertone selfie ✦/i,
    });
    fireEvent.click(snapBtn);

    expect(
      screen.getByText("African Melanin & Undertone Analysis")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Center face inside the oval/i)
    ).toBeInTheDocument();
  });

  it("navigates forward through consultation steps", () => {
    renderRecommend();

    // Starts on Step 1
    expect(screen.getByText(/Step 01 \/ Beauty Focus/i)).toBeInTheDocument();

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: /start your beauty consultation/i }));
    expect(screen.getByText(/Step 02 \/ Skin & Hair Profile/i)).toBeInTheDocument();

    // Advance to Step 3
    fireEvent.click(screen.getByRole("button", { name: /continue to climate concerns/i }));
    expect(screen.getByText(/Step 03 \/ Climate Concerns/i)).toBeInTheDocument();
  });
});

