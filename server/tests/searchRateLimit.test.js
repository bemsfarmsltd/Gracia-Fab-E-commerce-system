import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Rate limits are relaxed under NODE_ENV=test (see app.js), so this file
// loads a fresh copy of the app with production limits to check them for real.
let app;
let mongod;
const originalEnv = process.env.NODE_ENV;

// Starting a database and loading a fresh copy of the whole app is slow when
// every test file runs in parallel, so allow more than the 10 s default.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  process.env.NODE_ENV = "production";
  vi.resetModules();
  app = (await import("../app.js")).default;
}, 60_000);

afterAll(async () => {
  process.env.NODE_ENV = originalEnv;
  vi.resetModules();
  await mongoose.disconnect();
  await mongod.stop();
});

describe("search rate limits (production settings)", () => {
  it("doesn't throttle autocomplete suggestions at normal typing speed", async () => {
    // A shopper pausing 12 times while typing within a minute — previously
    // the 6th request got a 429 because suggestions shared the 5/min AI cap.
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app).get(`/api/search/suggestions?q=se${"r".repeat(i)}`);
      expect(res.status).not.toBe(429);
    }
  });

  it("still caps the AI-powered search at 5 per minute", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post("/api/search").send({ query: `dry skin serum ${i}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });
});
