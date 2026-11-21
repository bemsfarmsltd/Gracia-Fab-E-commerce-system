import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { readToken, isExpired, needsRenewal } from "../../utils/session";

const DAY = 24 * 60 * 60;
const now = () => Math.floor(Date.now() / 1000);
// Unsigned test tokens: the browser only reads the dates.
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const token = ({ iat, exp }) => `${b64({ alg: "HS256" })}.${b64({ id: "u1", iat, exp })}.sig`;
const storedUser = { _id: "u1", name: "Ada", email: "ada@example.com", isAdmin: false };

function Who() {
  const { user } = useAuth();
  return <p>{user ? `signed in as ${user.name}${user.isAdmin ? " (admin)" : ""}` : "signed out"}</p>;
}
const signIn = (t) => {
  localStorage.setItem("token", t);
  localStorage.setItem("user", JSON.stringify(storedUser));
};

describe("session tokens", () => {
  it("read the dates and decide when to renew", () => {
    const fresh = token({ iat: now(), exp: now() + 7 * DAY });
    const dayOld = token({ iat: now() - DAY - 5, exp: now() + 6 * DAY });
    const old = token({ iat: now() - 8 * DAY, exp: now() - DAY });
    expect(readToken(fresh).expiresAt).toBeGreaterThan(Date.now());
    expect(isExpired(fresh)).toBe(false);
    expect(needsRenewal(fresh)).toBe(false);
    expect(needsRenewal(dayOld)).toBe(true);
    expect(isExpired(old)).toBe(true);
    expect(needsRenewal(old)).toBe(false);
    expect(isExpired("garbage")).toBe(true);
  });
});

describe("AuthProvider sessions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("clears a session that expired instead of looking signed in", async () => {
    signIn(token({ iat: now() - 8 * DAY, exp: now() - DAY }));
    const fetchSpy = vi.spyOn(window, "fetch");
    render(<AuthProvider><Who /></AuthProvider>);
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a fresh session without asking the server", async () => {
    signIn(token({ iat: now(), exp: now() + 7 * DAY }));
    const fetchSpy = vi.spyOn(window, "fetch");
    render(<AuthProvider><Who /></AuthProvider>);
    expect(await screen.findByText("signed in as Ada")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("quietly renews a day-old session and picks up account changes", async () => {
    const old = token({ iat: now() - 2 * DAY, exp: now() + 5 * DAY });
    const renewed = token({ iat: now(), exp: now() + 7 * DAY });
    signIn(old);
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ...storedUser, isAdmin: true, token: renewed }),
    });
    render(<AuthProvider><Who /></AuthProvider>);
    expect(await screen.findByText("signed in as Ada (admin)")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/auth/refresh"), expect.objectContaining({ method: "POST", headers: { Authorization: `Bearer ${old}` } }));
    expect(localStorage.getItem("token")).toBe(renewed);
  });

  it("signs out when the server refuses to renew", async () => {
    signIn(token({ iat: now() - 2 * DAY, exp: now() + 5 * DAY }));
    vi.spyOn(window, "fetch").mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("signed out")).toBeInTheDocument());
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("stays signed in when offline or the server is waking up", async () => {
    const old = token({ iat: now() - 2 * DAY, exp: now() + 5 * DAY });
    signIn(old);
    vi.spyOn(window, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AuthProvider><Who /></AuthProvider>);
    expect(await screen.findByText("signed in as Ada")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("signed in as Ada")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe(old);
  });
});
