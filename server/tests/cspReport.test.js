import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("POST /api/csp-report", () => {
  it("accepts a classic report-uri violation report", async () => {
    const res = await request(app)
      .post("/api/csp-report")
      .set("Content-Type", "application/csp-report")
      .send(
        JSON.stringify({
          "csp-report": {
            "document-uri": "https://gracia-fab.vercel.app/checkout",
            "violated-directive": "script-src",
            "blocked-uri": "https://evil.example.com/x.js",
          },
        }),
      );
    expect(res.status).toBe(204);
  });

  it("accepts the newer Reporting API format", async () => {
    const res = await request(app)
      .post("/api/csp-report")
      .set("Content-Type", "application/reports+json")
      .send(
        JSON.stringify([
          { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "http://x.test/a.png" } },
        ]),
      );
    expect(res.status).toBe(204);
  });

  it("doesn't fall over on an empty or junk body", async () => {
    const res = await request(app).post("/api/csp-report").set("Content-Type", "application/csp-report").send("{}");
    expect(res.status).toBe(204);
  });
});
