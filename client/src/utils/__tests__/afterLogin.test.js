import { describe, it, expect } from "vitest";
import { afterLoginPath, homePath, safeFrom, VANITY_PATH } from "../afterLogin";

describe("afterLogin", () => {
  it("sends customers to My Vanity and admins to the admin dashboard by default", () => {
    expect(afterLoginPath({ isAdmin: false })).toBe(VANITY_PATH);
    expect(afterLoginPath({ isAdmin: true })).toBe("/admin");
  });

  it("returns people to the page they were trying to reach", () => {
    expect(afterLoginPath({ isAdmin: false }, "/checkout")).toBe("/checkout");
    expect(afterLoginPath({ isAdmin: true }, "/products?category=wig")).toBe("/products?category=wig");
  });

  it("never follows links off the site or back to the sign-in pages", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "/verify-code?x=1", 42, null]) {
      expect(safeFrom(bad)).toBeNull();
      expect(afterLoginPath({ isAdmin: false }, bad)).toBe(VANITY_PATH);
    }
  });

  it("points the logo at My Vanity only when signed in", () => {
    expect(homePath({ name: "Ada" })).toBe(VANITY_PATH);
    expect(homePath(null)).toBe("/");
  });
});
