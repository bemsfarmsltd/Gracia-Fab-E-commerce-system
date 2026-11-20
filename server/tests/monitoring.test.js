import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { scrubEvent, captureError, initMonitoring, isMonitoringOn, __setSentryForTests } from "../utils/monitoring.js";
import { sendServerError } from "../utils/httpErrors.js";
import { errorHandler } from "../middleware/errorMiddleware.js";

const fakeSentry = () => {
  const scope = { setTag: vi.fn(), setExtra: vi.fn() };
  return { scope, captureException: vi.fn(), withScope: (fn) => fn(scope) };
};

afterEach(() => {
  __setSentryForTests(null);
  vi.unstubAllEnvs();
});

describe("crash alerts", () => {
  it("stay off without SENTRY_DSN and never throw", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    expect(await initMonitoring()).toBe(false);
    expect(isMonitoringOn()).toBe(false);
    expect(() => captureError(new Error("x"))).not.toThrow();
  });

  it("strip private data before anything is sent", () => {
    const event = scrubEvent({
      user: { email: "ada@example.com", ip_address: "1.2.3.4" },
      message: "Login failed for ada@example.com",
      exception: { values: [{ value: "E11000 duplicate key { email: \"ada@example.com\" }" }] },
      request: {
        url: "https://api/x?t=secret-token&page=2",
        data: { password: "hunter22", code: "123456" },
        cookies: { a: "b" },
        query_string: "t=secret-token",
        headers: { Authorization: "Bearer abc.def", cookie: "x", "user-agent": "Chrome", "x-forwarded-for": "1.2.3.4" },
      },
      extra: { note: "token Bearer abc.def for bob@example.org" },
      breadcrumbs: [{ message: "fetch ada@example.com", data: { url: "/api/auth?code=1" } }],
    });

    const sent = JSON.stringify(event);
    for (const secret of ["ada@example.com", "bob@example.org", "hunter22", "123456", "secret-token", "abc.def", "1.2.3.4"]) {
      expect(sent).not.toContain(secret);
    }
    expect(event.request.headers["user-agent"]).toBe("Chrome");
    expect(event.request.url).toBe("https://api/x?t=[redacted]&page=2");
    expect(event.exception.values[0].value).toContain("[email]");
  });

  it("report server errors from controllers with where they happened", async () => {
    const s = fakeSentry();
    __setSentryForTests(s);
    const app = express();
    app.get("/api/boom", (req, res) => sendServerError(res, new Error("db down"), "boom error"));
    const res = await request(app).get("/api/boom");

    expect(res.status).toBe(500);
    expect(s.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: "db down" }));
    expect(s.scope.setTag).toHaveBeenCalledWith("context", "boom error");
    expect(s.scope.setTag).toHaveBeenCalledWith("method", "GET");
  });

  it("report 5xx from the error handler but not ordinary 4xx", async () => {
    const s = fakeSentry();
    __setSentryForTests(s);
    const app = express();
    app.get("/crash", () => { throw new Error("unexpected"); });
    app.get("/missing", (req, res, next) => next(Object.assign(new Error("Route not found"), { status: 404 })));
    app.use(errorHandler);

    expect((await request(app).get("/missing")).status).toBe(404);
    expect(s.captureException).not.toHaveBeenCalled();
    expect((await request(app).get("/crash")).status).toBe(500);
    expect(s.captureException).toHaveBeenCalledTimes(1);
  });
});
