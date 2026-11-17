import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { sendServerError, GENERIC_SERVER_ERROR } from "../utils/httpErrors.js";
import { errorHandler, notFound } from "../middleware/errorMiddleware.js";

const leaky = new Error("E11000 duplicate key error collection: test.users index: email_1");

function makeApp() {
  const app = express();
  app.get("/handled", (req, res) => sendServerError(res, leaky, "test"));
  app.get("/thrown", () => { throw leaky; });
  app.get("/bad", (req, res, next) => { const e = new Error("Bad input"); e.status = 400; next(e); });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const originalEnv = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = originalEnv; });

describe("server errors", () => {
  it("hide internal error text from customers in production", async () => {
    process.env.NODE_ENV = "production";
    const app = makeApp();
    for (const path of ["/handled", "/thrown"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe(GENERIC_SERVER_ERROR);
      expect(JSON.stringify(res.body)).not.toMatch(/E11000|users|stack/);
    }
  });

  it("keep deliberate 4xx messages in production", async () => {
    process.env.NODE_ENV = "production";
    const app = makeApp();
    expect((await request(app).get("/bad")).body.message).toBe("Bad input");
    expect((await request(app).get("/missing")).body.message).toBe("Route not found: /missing");
  });

  it("show the real message outside production for debugging", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(makeApp()).get("/handled");
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/E11000/);
  });
});
