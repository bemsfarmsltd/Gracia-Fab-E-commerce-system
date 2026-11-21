import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// The AI is mocked: `aiReply` is what the model "answers" (or an Error).
let aiReply = new Error("AI down");
vi.mock("groq-sdk", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => {
          if (aiReply instanceof Error) throw aiReply;
          return { choices: [{ message: { content: JSON.stringify(aiReply) } }] };
        },
      },
    };
  },
}));

const { default: app } = await import("../app.js");
const { default: Product } = await import("../models/Product.js");

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const base = { description: "x", image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/p.jpg", brand: "Test", price: 5000 };
let dry, oily, wig, soldOut;
beforeEach(async () => {
  await Product.deleteMany({});
  aiReply = new Error("AI down");
  [dry, oily, wig, soldOut] = await Product.create([
    { ...base, name: "Dry Skin Cream", category: "skincare", stock: 5, suitableFor: { skinType: ["dry"], concern: ["dryness"] } },
    { ...base, name: "Oily Skin Gel", category: "skincare", stock: 5, suitableFor: { skinType: ["oily"] } },
    { ...base, name: "Body Wave Wig", category: "wig", stock: 2 },
    { ...base, name: "Sold Out Dry Balm", category: "skincare", stock: 0, suitableFor: { skinType: ["dry"], concern: ["dryness"] } },
  ]);
});

const ask = (body) => request(app).post("/api/recommend").send(body);

describe("AI Advisor recommendations", () => {
  it("fall back to rule-based picks from in-stock products when the AI is down", async () => {
    const res = await ask({ skinType: "Dry Skin", skinConcerns: "Dryness", lookingFor: "skincare" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("rule-based");
    const names = res.body.recommendations.map((r) => r.product.name);
    expect(names).toHaveLength(3);
    expect(names).not.toContain("Sold Out Dry Balm");
    expect(names[0]).toBe("Dry Skin Cream");
    for (const r of res.body.recommendations) expect(r.reason).toBeTruthy();
  });

  it("keep only real, in-stock AI picks and drop invented or repeated ones", async () => {
    aiReply = {
      recommendations: [
        { productId: String(dry._id), reason: "Rich cream for dry skin.", tip: "Apply on damp skin." },
        { productId: "64b000000000000000000000", reason: "Invented", tip: "-" },
        { productId: String(dry._id), reason: "Duplicate", tip: "-" },
        { productId: String(soldOut._id), reason: "Out of stock", tip: "-" },
        { productId: String(wig._id), reason: "A wig you asked about.", tip: "Store on a stand." },
      ],
    };
    const res = await ask({ skinType: "Dry Skin" });
    expect(res.body.source).toBe("groq-ai");
    expect(res.body.recommendations.map((r) => r.product.name)).toEqual(["Dry Skin Cream", "Body Wave Wig"]);
    expect(res.body.recommendations[0]).toMatchObject({ reason: "Rich cream for dry skin.", tip: "Apply on damp skin." });
  });

  it("fall back when every AI pick is invalid", async () => {
    aiReply = { recommendations: [{ productId: "nope", reason: "x", tip: "y" }] };
    const res = await ask({ skinType: "Oily Skin" });
    expect(res.body.source).toBe("rule-based");
    expect(res.body.recommendations[0].product.name).toBe("Oily Skin Gel");
  });

  it("return no picks (never invented ones) when the catalogue is empty", async () => {
    await Product.deleteMany({});
    const res = await ask({ skinType: "Dry Skin" });
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual([]);
  });

  it("reject over-long answers", async () => {
    expect((await ask({ skinType: "x".repeat(201) })).status).toBe(400);
  });
});
