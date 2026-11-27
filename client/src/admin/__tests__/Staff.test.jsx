import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminStaff from "../../components/admin/AdminStaff";
import SetPassword from "../SetPassword.jsx";
import { canUsePortal, canSeeTab, homeTab } from "../../utils/portal";

const STAFF = {
  name: "Chioma", role: "staff", isAdmin: false,
  permissions: ["orders.view", "orders.fulfil", "products.view", "stock.count", "customers.view", "customers.notes", "bookings", "messages"],
};
const OWNER = { name: "MD", isAdmin: true, role: "owner" };

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });

afterEach(() => vi.restoreAllMocks());

describe("who sees what", () => {
  it("lets owners and staff into the portal, not customers or old sessions without a role", () => {
    expect(canUsePortal(OWNER)).toBe(true);
    expect(canUsePortal(STAFF)).toBe(true);
    expect(canUsePortal({ name: "Ada", role: "customer" })).toBe(false);
    expect(canUsePortal({ name: "Old admin session", isAdmin: true })).toBe(true);
    expect(canUsePortal(null)).toBe(false);
  });

  it("starts staff on the Order Board and the owner on the Overview", () => {
    expect(homeTab(STAFF)).toBe("orderboard");
    expect(homeTab(OWNER)).toBe("overview");
    expect(canSeeTab(STAFF, "vouchers")).toBe(false);
    expect(canSeeTab(STAFF, "staff")).toBe(false);
    expect(canSeeTab(OWNER, "staff")).toBe(true);
  });

  it("shows staff only their sections in the menu", () => {
    render(
      <MemoryRouter>
        <AdminSidebar activeTab="orderboard" setActiveTab={vi.fn()} mobileOpen={false} setMobileOpen={vi.fn()} user={STAFF} />
      </MemoryRouter>,
    );
    for (const name of [/^\W*orders$/i, /order board/i, /products/i, /inventory/i, /customers/i, /messages/i, /bookings/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    for (const name of [/overview/i, /sales/i, /vouchers/i, /subscribers/i, /^\W*staff$/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByText("Staff", { selector: ".admin-user-role" })).toBeInTheDocument();
  });

  it("shows the owner the Staff section", () => {
    render(
      <MemoryRouter>
        <AdminSidebar activeTab="overview" setActiveTab={vi.fn()} mobileOpen={false} setMobileOpen={vi.fn()} user={OWNER} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /^\W*staff$/i })).toBeInTheDocument();
    expect(screen.getByText("Owner", { selector: ".admin-user-role" })).toBeInTheDocument();
  });
});

describe("setting a password from the invite", () => {
  const TOKEN = "a".repeat(64);
  const renderPage = (search) => render(
    <MemoryRouter initialEntries={[`/set-password${search}`]}>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/login" element={<p>SIGN IN PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );

  it("sets the password and sends them to sign in", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => json(200, { email: "chioma@example.com" }));
    renderPage(`?token=${TOKEN}`);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await screen.findByText(/password is set for chioma@example.com/i);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: TOKEN, password: "newpass123" });
    fireEvent.click(screen.getByRole("link", { name: "Go to sign in" }));
    expect(screen.getByText("SIGN IN PAGE")).toBeInTheDocument();
  });

  it("checks the two passwords match before sending", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPage(`?token=${TOKEN}`);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "different1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains an expired link and a link without its code", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json(400, { message: "This link has expired or was already used. Ask the owner to send a new one." }));
    renderPage(`?token=${TOKEN}`);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await screen.findByText(/expired or was already used/);
  });

  it("explains a link with no code", () => {
    renderPage("");
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument();
  });
});

describe("Staff screen (owner)", () => {
  it("lists people and adds staff, telling the owner what happens next", async () => {
    const calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
      calls.push([opts.method || "GET", url]);
      if ((opts.method || "GET") === "POST") return json(201, { _id: "2", name: "Chioma", email: "chioma@example.com", role: "staff", invitePending: true });
      return json(200, {
        people: [{ _id: "1", name: "MD", email: "md@example.com", role: "owner", invitePending: false }],
        staffPermissions: [{ key: "orders.view", label: "See orders and the Order Board" }],
      });
    });
    const setAdminNotice = vi.fn();
    render(<AdminStaff setAdminError={vi.fn()} setAdminNotice={setAdminNotice} />);
    await screen.findByText("md@example.com");
    expect(screen.getByText("See orders and the Order Board")).toBeInTheDocument();
    // Owners can't be removed from this screen.
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Chioma" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "chioma@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add staff" }));
    await waitFor(() => expect(setAdminNotice).toHaveBeenCalledWith(expect.stringMatching(/emailed a link to set their password/)));
    expect(calls.some(([m, u]) => m === "POST" && u.endsWith("/api/admin/staff"))).toBe(true);
  });
});
