import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import { SESSION_DAYS } from "../utils/generateToken.js";

let mongod;
const DAY = 24 * 60 * 60;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(() => User.deleteMany({}));

const register = async (email) =>
  (await request(app).post("/api/auth/register").send({ name: "Ada Obi", email, password: "password123" })).body;

describe("sessions", () => {
  it("last 7 days from sign-in", async () => {
    const { token } = await register("a@example.com");
    const { iat, exp } = jwt.decode(token);
    expect(SESSION_DAYS).toBe(7);
    expect(exp - iat).toBe(7 * DAY);
  });

  it("renew with a fresh 7-day token and the account's current details", async () => {
    const old = jwt.sign({ id: (await User.create({ name: "Gracia", email: "md@example.com", password: "password123" }))._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    // Six days in: still valid, and meanwhile she was made an admin.
    await User.updateOne({ email: "md@example.com" }, { isAdmin: true });

    const res = await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${old}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.body).toMatchObject({ name: "Gracia", email: "md@example.com", isAdmin: true });
    const { exp } = jwt.decode(res.body.token);
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(7 * DAY - 60);
    // The new token works.
    expect((await request(app).get("/api/auth/profile").set("Authorization", `Bearer ${res.body.token}`)).status).toBe(200);
  });

  it("refuse expired, missing or tampered tokens", async () => {
    const user = await User.create({ name: "B", email: "b@example.com", password: "password123" });
    const expired = jwt.sign({ id: user._id, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    const forged = jwt.sign({ id: user._id }, "not-the-secret", { expiresIn: "7d" });
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${expired}`)).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });

  it("can't be renewed after a password change", async () => {
    const { token } = await register("c@example.com");
    await new Promise((r) => setTimeout(r, 1100));
    await User.updateOne({ email: "c@example.com" }, { passwordChangedAt: new Date(Date.now() + 2000) });
    const res = await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
