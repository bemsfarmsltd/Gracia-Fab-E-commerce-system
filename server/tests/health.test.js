import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("GET /health", () => {
  it("returns the status payload", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(["healthy", "degraded"]).toContain(res.body.status);
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.version).toMatch(/^(dev|[0-9a-f]{7})$/);
  });

  it("names missing settings as yes/no, never their values, and isn't healthy without a database", async () => {
    process.env.MONGO_URI = "mongodb+srv://user:supersecret@example.net/db";
    delete process.env.MONNIFY_API_KEY;
    const res = await request(app).get("/health");

    expect(res.body.status).toBe("degraded"); // no DB connected in this test
    expect(res.body.databaseConnected).toBe(false);
    expect(res.body.settings.database).toBe(true);
    expect(res.body.settings.payments).toBe(false);
    expect(res.body.missingRequired).toContain("payments");
    expect(JSON.stringify(res.body)).not.toContain("supersecret");
  });
});
