import { describe, it, expect, vi, afterEach } from "vitest";
import { scrubEvent, scrubBreadcrumb, reportError, initMonitoring, __setSentryForTests } from "../monitoring";

const fakeSentry = () => {
  const scope = { setExtra: vi.fn() };
  return { scope, captureException: vi.fn(), withScope: (fn) => fn(scope) };
};

afterEach(() => __setSentryForTests(null));

describe("crash alerts (browser)", () => {
  it("stay off without a DSN and never throw", async () => {
    expect(await initMonitoring("")).toBe(false);
    expect(() => reportError(new Error("x"))).not.toThrow();
  });

  it("strip emails, secret link parameters, cookies and the user", () => {
    const e = scrubEvent({
      user: { ip_address: "1.2.3.4" },
      message: "Failed for ada@example.com",
      request: { url: "https://www.graciafab.com/unsubscribe?u=1&t=abc123", cookies: { a: 1 }, headers: { Referer: "https://x/?t=1" } },
      exception: { values: [{ value: "reference=MNFY-123 failed" }] },
    });
    const sent = JSON.stringify(e);
    for (const s of ["1.2.3.4", "ada@example.com", "abc123", "MNFY-123"]) expect(sent).not.toContain(s);
    expect(e.request.url).toBe("https://www.graciafab.com/unsubscribe?u=1&t=[redacted]");
  });

  it("drop console breadcrumbs and redact URLs in the rest", () => {
    expect(scrubBreadcrumb({ category: "console", message: "token" })).toBeNull();
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "/api/orders?reference=R1" } }).data.url).toBe("/api/orders?reference=[redacted]");
    expect(scrubBreadcrumb({ category: "navigation", data: { from: "/a?code=9", to: "/b" } }).data.from).toBe("/a?code=[redacted]");
  });

  it("send errors with extra details once Sentry is running", () => {
    const s = fakeSentry();
    __setSentryForTests(s);
    const err = new Error("render failed");
    reportError(err, { componentStack: "at Page" });
    expect(s.captureException).toHaveBeenCalledWith(err);
    expect(s.scope.setExtra).toHaveBeenCalledWith("componentStack", "at Page");
  });
});
