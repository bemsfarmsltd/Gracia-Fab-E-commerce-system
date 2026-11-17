import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import PrivacyPolicy from "../PrivacyPolicy";
import TermsOfService from "../TermsOfService";
import ShippingReturns from "../ShippingReturns";
import Footer from "../../components/Footer";
import { CartProvider } from "../../context/CartContext";

function renderWithProviders(ui) {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CartProvider>{ui}</CartProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("Legal Pages (Standard Drafts for Owner Review)", () => {
  it("renders Privacy Policy with owner review notice and Monnify disclaimer", () => {
    renderWithProviders(<PrivacyPolicy />);

    expect(screen.getByRole("heading", { level: 1, name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getByText(/Draft for Store Owner Review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Monnify/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /Terms of Service/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /Shipping & Returns/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Terms of Service with owner review notice and Nigerian Naira pricing", () => {
    renderWithProviders(<TermsOfService />);

    expect(screen.getByRole("heading", { level: 1, name: /Terms of Service/i })).toBeInTheDocument();
    expect(screen.getByText(/Draft for Store Owner Review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nigerian Naira/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Cosmetic Notice/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Privacy Policy/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Shipping & Returns with flat rate ₦2,500 and hygiene return rules", () => {
    renderWithProviders(<ShippingReturns />);

    expect(screen.getByRole("heading", { level: 1, name: /Shipping & Returns/i })).toBeInTheDocument();
    expect(screen.getByText(/Draft for Store Owner Review/i)).toBeInTheDocument();
    expect(screen.getByText(/₦2,500 flat rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Cosmetic Hygiene & Return Guidelines/i)).toBeInTheDocument();
  });

  it("renders legal links in the global Footer", () => {
    renderWithProviders(<Footer />);

    const privacyLinks = screen.getAllByRole("link", { name: /Privacy Policy/i });
    const termsLinks = screen.getAllByRole("link", { name: /Terms of Service/i });
    const shippingLinks = screen.getAllByRole("link", { name: /Shipping & Returns/i });

    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
    expect(shippingLinks.length).toBeGreaterThanOrEqual(1);
  });
});
