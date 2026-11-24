import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminHeader from "../AdminHeader";
import AdminSidebar from "../AdminSidebar";

describe("admin brand", () => {
  it("shows the Gracia Fab logo and name at the top of the header (phone/tablet)", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminHeader activeTab="overview" setMobileOpen={vi.fn()} user={{ email: "a@example.com" }} />
      </MemoryRouter>,
    );
    const brand = container.querySelector(".admin-topbar-brand");
    expect(brand).not.toBeNull();
    expect(brand.querySelector("img").getAttribute("src")).toBe("/icons/icon-192.png");
    expect(within(brand).getByText("GRACIA FAB")).toBeInTheDocument();
    // The menu button comes first, then the brand: top left.
    const main = container.querySelector(".admin-topbar-main");
    expect(main.children[0]).toBe(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(main.children[1]).toBe(brand);
  });

  it("shows the logo, not a placeholder star, in the sidebar", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminSidebar activeTab="overview" setActiveTab={vi.fn()} mobileOpen={false} setMobileOpen={vi.fn()} user={{ name: "Admin" }} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    const brand = container.querySelector(".admin-sidebar-brand");
    expect(brand.querySelector("img").getAttribute("src")).toBe("/icons/icon-192.png");
    expect(brand.textContent).not.toContain("✦");
  });
});
