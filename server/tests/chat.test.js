import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Groq is mocked to fail, as when the key is wrong or the service is down.
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: async () => { throw new Error("AI down"); } } };
  },
}));

const { default: app } = await import("../app.js");

let mongod;
const saved = {};
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY"]) saved[k] = process.env[k];
});
afterAll(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await mongoose.disconnect();
  await mongod.stop();
});

describe("POST /api/chat", () => {
  it("needs a message", async () => {
    const res = await request(app).post("/api/chat").send({});
    expect(res.status).toBe(400);
  });

  // A 503 makes the chat widget use its built-in answers (delivery, hours,
  // booking) instead of showing a canned "reply" as if the AI had answered.
  it("returns 503, not a canned reply, when no AI key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    const res = await request(app).post("/api/chat").send({ message: "How much is delivery?" });
    expect(res.status).toBe(503);
    expect(res.body.reply).toBeUndefined();
  });

  it("returns 503 when the AI provider fails", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    const res = await request(app).post("/api/chat").send({ message: "Do you have wigs?" });
    expect(res.status).toBe(503);
    expect(res.body.reply).toBeUndefined();
  });
});
