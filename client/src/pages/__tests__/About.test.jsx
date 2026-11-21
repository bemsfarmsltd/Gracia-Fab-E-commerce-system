import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import About from "../About";
import { CartProvider } from "../../context/CartContext";
import { AuthContext } from "../../hooks/useAuth";

const renderAbout = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null, loading: false }}>
          <CartProvider>
            <About />
          </CartProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("About page", () => {
  beforeEach(() => {
    window.fetch = globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ _id: "w1", name: "Body Wave Wig", category: "wig", stock: 2, image: "https://res.cloudinary.com/x/wig.jpg" }],
    });
  });

  it("tells the real story: Bems Group, founded 2024, Umuahia North, now online", () => {
    renderAbout();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Gracia Fab, ?Umuahia/);
    expect(screen.getAllByText(/Bems Group/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Umuahia North/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8am/).length).toBeGreaterThan(0);
  });

  it("lists the in-store services the owner confirmed", () => {
    renderAbout();
    expect(screen.getByRole("heading", { name: "Hair salon" })).toBeInTheDocument();
    expect(screen.getByText(/install wigs/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /bridal makeup and accessories/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /consultations with our md/i })).toBeInTheDocument();
  });

  it("uses real product photos and none of the old invented claims", async () => {
    renderAbout();
    expect(await screen.findByAltText("A wig sold at Gracia Fab")).toHaveAttribute("src", "https://res.cloudinary.com/x/wig.jpg");
    for (const claim of [/single-donor/i, /money-back/i, /purity/i, /macro inspection/i, /cuticles/i, /hand-bleached/i, /certified/i]) {
      expect(screen.queryByText(claim)).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole("img").every((i) => !/unsplash/.test(i.getAttribute("src") || ""))).toBe(true);
  });
});
