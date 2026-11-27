import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../context/AuthContext.jsx";
import AdminLogin from "../AdminLogin.jsx";

vi.mock("../../pages/AdminDashboard", () => ({ default: () => <p>DASHBOARD</p> }));

// A well-formed token that expires in a week (the session code checks exp).
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const TOKEN = `${b64({ alg: "HS256" })}.${b64({ id: "1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400 })}.sig`;

const jsonResponse = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={<p>ADMIN HOME</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("admin portal sign-in", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("lets an admin in after the emailed code", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url.endsWith("/api/auth/login")) return jsonResponse(200, { requiresOtp: true, email: "md@example.com" });
      if (url.endsWith("/api/auth/verify-otp")) return jsonResponse(200, { _id: "1", name: "MD", email: "md@example.com", isAdmin: true, token: TOKEN });
      return jsonResponse(404, {});
    });
    renderLogin();
    fill("Email", "md@example.com");
    fill("Password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByLabelText("6-digit code");
    expect(screen.getByText(/emailed a 6-digit code to md@example.com/)).toBeInTheDocument();
    fill("6-digit code", "123456");
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
    await screen.findByText("ADMIN HOME");
    expect(JSON.parse(localStorage.getItem("user")).isAdmin).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lets staff in too, and remembers their role and permissions", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      jsonResponse(200, { _id: "3", name: "Chioma", email: "chioma@example.com", isAdmin: false, role: "staff", permissions: ["orders.view"], token: TOKEN }));
    renderLogin();
    fill("Email", "chioma@example.com");
    fill("Password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("ADMIN HOME");
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({ role: "staff", permissions: ["orders.view"] });
  });

  it("refuses a customer account and signs it straight back out", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      jsonResponse(200, { _id: "2", name: "Ada", email: "ada@example.com", isAdmin: false, role: "customer", token: TOKEN }));
    renderLogin();
    fill("Email", "ada@example.com");
    fill("Password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("This account doesn't have staff or admin access.");
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.queryByText("ADMIN HOME")).toBeNull();
  });

  it("shows the server's message for a wrong password", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse(401, { message: "Invalid email or password" }));
    renderLogin();
    fill("Email", "md@example.com");
    fill("Password", "nope");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Invalid email or password");
  });
});

describe("leaving the shop for the admin app", () => {
  afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

  it("loads /admin with a full page load, once, and explains instead of looping", async () => {
    const { OpenAdminApp } = await import("../../App.jsx");
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace });

    const first = render(<MemoryRouter initialEntries={["/admin/orders?x=1"]}><OpenAdminApp /></MemoryRouter>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/orders?x=1"));
    first.unmount();

    // Served the shop again straight away (bad host rule): stop and explain.
    render(<MemoryRouter initialEntries={["/admin"]}><OpenAdminApp /></MemoryRouter>);
    await screen.findByText(/admin portal couldn't open/i);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
