import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// The weekly job asks Groq to write the email; stand in for it.
vi.mock("groq-sdk", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({ choices: [{ message: { content: '{"subject":"New picks for you","body":"Hi! We think you will love these."}' } }] }),
      },
    };
  },
}));
// Capture what gets queued instead of needing Redis.
const queued = [];
vi.mock("../queues/index.js", async (orig) => ({
  ...(await orig()),
  addToQueue: vi.fn(async (_q, name, data) => { queued.push({ name, data }); return null; }),
}));

import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { sendMarketingEmails } from "../controllers/marketingController.js";
import { unsubscribeToken, unsubscribeUrl } from "../utils/unsubscribe.js";

let mongod;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({})]);
  queued.length = 0;
});

const makeUser = (email = "ada@example.com") =>
  User.create({ name: "Ada Obi", email, password: "password123" });

describe("unsubscribe link", () => {
  it("turns marketing emails off without logging in", async () => {
    const user = await makeUser();
    const res = await request(app).get(`/api/email/unsubscribe?u=${user._id}&t=${unsubscribeToken(String(user._id))}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/You're unsubscribed/);
    expect((await User.findById(user._id)).emailPreferences.marketing).toBe(false);
  });

  it("rejects a forged or edited link", async () => {
    const user = await makeUser();
    const other = await makeUser("bisi@example.com");
    // Signature for one user used on another's id.
    const res = await request(app).get(`/api/email/unsubscribe?u=${other._id}&t=${unsubscribeToken(String(user._id))}`);
    expect(res.status).toBe(400);
    expect((await User.findById(other._id)).emailPreferences.marketing).toBe(true);
    expect((await request(app).get("/api/email/unsubscribe?u=nope&t=x")).status).toBe(400);
  });

  it("supports Gmail/Outlook one-click unsubscribe (POST)", async () => {
    const user = await makeUser();
    const url = new URL(unsubscribeUrl(user._id));
    const res = await request(app)
      .post(`${url.pathname}${url.search}`)
      .type("form")
      .send("List-Unsubscribe=One-Click");
    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).emailPreferences.marketing).toBe(false);
  });
});

describe("weekly marketing email", () => {
  it("includes a working unsubscribe link and headers, and skips unsubscribed customers", async () => {
    await Product.create({ name: "Glow Serum", description: "d", price: 9000, image: "x", category: "skincare", rating: 5 });
    const viewed = await Product.create({ name: "Seen", description: "d", price: 1, image: "x", category: "skincare" });
    const keen = await makeUser("keen@example.com");
    const opted = await makeUser("opted@example.com");
    for (const u of [keen, opted]) {
      await User.updateOne({ _id: u._id }, { interests: [{ category: "skincare", productId: viewed._id, viewCount: 3 }] });
    }
    await User.updateOne({ _id: opted._id }, { "emailPreferences.marketing": false });

    const sent = await sendMarketingEmails();

    expect(sent).toBe(1);
    expect(queued).toHaveLength(1);
    const { data } = queued[0];
    expect(data.to).toBe("keen@example.com");
    expect(data.html).toContain(unsubscribeUrl(keen._id));
    expect(data.html).not.toContain("/dashboard\"");
    expect(data.headers["List-Unsubscribe"]).toBe(`<${unsubscribeUrl(keen._id)}>`);
    expect(data.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("account marketing preference", () => {
  it("can be read and switched off/on from the account page", async () => {
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email: "pref@example.com", password: "password123" });
    const auth = { Authorization: `Bearer ${reg.body.token}` };

    expect((await request(app).get("/api/auth/profile").set(auth)).body.marketingEmails).toBe(true);

    const off = await request(app).put("/api/auth/profile").set(auth).send({ marketingEmails: false });
    expect(off.status).toBe(200);
    expect(off.body.marketingEmails).toBe(false);
    expect((await request(app).get("/api/auth/profile").set(auth)).body.marketingEmails).toBe(false);

    await request(app).put("/api/auth/profile").set(auth).send({ marketingEmails: true });
    expect((await User.findOne({ email: "pref@example.com" })).emailPreferences.marketing).toBe(true);
  });
});
