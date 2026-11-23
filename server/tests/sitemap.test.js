import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import Product from "../models/Product.js";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /sitemap.xml", () => {
  it("lists pages, landing pages and products on the real site address", async () => {
    vi.stubEnv("FRONTEND_URL", "https://www.graciafab.com/");
    const p = await Product.create({ name: "Serum", description: "d", price: 1, image: "x", category: "skincare" });

    const res = await request(app).get("/sitemap.xml");

    // It used to throw on every request (`landingPages` referenced itself).
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/xml/);
    expect(res.text).toContain("<loc>https://www.graciafab.com/</loc>");
    expect(res.text).toContain(`<loc>https://www.graciafab.com/products/${p._id}</loc>`);
    expect(res.text).toContain("<loc>https://www.graciafab.com/beauty/bridal-skincare-routine-nigeria</loc>");
    expect(res.text).toContain("<loc>https://www.graciafab.com/shipping-returns</loc>");
    expect(res.text).not.toContain("vercel.app");
    expect(res.text).not.toContain("/login");
  });
});
