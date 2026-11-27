import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import StockTake from "../models/StockTake.js";
import StockMovement from "../models/StockMovement.js";
import Counter from "../models/Counter.js";
import generateToken from "../utils/generateToken.js";
import { changeStock, reconcile } from "../services/stock.js";
import { assignSku } from "../services/barcodes.js";

let mongod;
beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await StockTake.createIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), StockTake.deleteMany({}), StockMovement.deleteMany({}), Counter.deleteMany({})]);
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (u) => generateToken(u._id, { isAdmin: true });
const owner = () => User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = (name = "Chioma", email = "chioma@example.com") => User.create({ name, email, password: "password123", role: "staff" });
const product = async (name, stock, category = "skincare") => {
  const p = await Product.create({ name, description: "d", price: 1000, image: "/x.jpg", category, stock });
  return Product.findById((await assignSku(p._id))._id);
};
const api = (t) => ({
  start: (body) => request(app).post("/api/admin/stocktakes").set(bearer(t)).send(body),
  scan: (id, code) => request(app).post(`/api/admin/stocktakes/${id}/scan`).set(bearer(t)).send({ code }),
  set: (id, pid, counted) => request(app).put(`/api/admin/stocktakes/${id}/lines/${pid}`).set(bearer(t)).send({ counted }),
  add: (id, pid, by) => request(app).put(`/api/admin/stocktakes/${id}/lines/${pid}`).set(bearer(t)).send({ by }),
  current: () => request(app).get("/api/admin/stocktakes/current").set(bearer(t)),
  complete: (id, body = {}) => request(app).post(`/api/admin/stocktakes/${id}/complete`).set(bearer(t)).send(body),
  cancel: (id) => request(app).post(`/api/admin/stocktakes/${id}/cancel`).set(bearer(t)),
});

describe("stock take", () => {
  it("staff count by scanning and typing; the owner approves; only the differences change stock", async () => {
    const chioma = api(tokenFor(await staff()));
    const emeka = api(tokenFor(await staff("Emeka", "emeka@example.com")));
    const md = api(tokenFor(await owner()));
    const shea = await product("Shea Body Butter", 10);
    const oil = await product("Hair Oil", 4);
    const wig = await product("Bob Wig", 2, "wigs");

    const started = await chioma.start({ name: "End of November" });
    expect(started.status).toBe(201);
    const id = started.body._id;
    // Only one open count at a time.
    expect((await emeka.start({ name: "Another" })).status).toBe(409);

    // Two people scanning the same product add up.
    for (let i = 0; i < 4; i++) await chioma.scan(id, shea.barcode).expect(200);
    const last = await emeka.scan(id, "gf-000001");
    expect(last.body).toMatchObject({ product: { name: "Shea Body Butter" }, counted: 5 });
    await emeka.set(id, oil._id, 4).expect(200);
    expect((await chioma.scan(id, "nope")).status).toBe(404);

    const cur = await chioma.current().expect(200);
    expect(cur.body.lines.map((l) => [l.name, l.counted, l.systemAtCount, l.difference])).toEqual([
      ["Hair Oil", 4, 4, 0],
      ["Shea Body Butter", 5, 10, -5],
    ]);
    expect(cur.body.uncounted.map((u) => u.name)).toEqual(["Bob Wig"]);
    expect(cur.body.totals).toMatchObject({ counted: 2, missingUnits: 5, extraUnits: 0, uncounted: 1, uncountedUnits: 2 });

    // Staff can't approve.
    expect((await chioma.complete(id)).status).toBe(403);

    const done = await md.complete(id);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: "completed", completedByName: "Gracia MD", totals: { missingUnits: 5, extraUnits: 0, unchanged: 1 } });
    expect((await Product.findById(shea._id)).stock).toBe(5);
    expect((await Product.findById(oil._id)).stock).toBe(4);
    expect((await Product.findById(wig._id)).stock).toBe(2); // not counted, not zeroed
    const move = await StockMovement.findOne({ product: shea._id, reason: "count" }).lean();
    expect(move).toMatchObject({ change: -5, balanceAfter: 5, actorName: "Gracia MD", note: 'Stock take "End of November"' });
    expect((await reconcile(shea._id)).matches).toBe(true);
    // Finished: no more counting, and a new count can start.
    expect((await chioma.scan(id, shea.barcode)).status).toBe(400);
    expect((await chioma.start({ name: "December" })).status).toBe(201);
  });

  it("keeps sales made while the shop stays open during the count", async () => {
    const md = api(tokenFor(await owner()));
    const shea = await product("Shea Body Butter", 10);
    const id = (await md.start({ name: "Busy Saturday" })).body._id;
    await md.set(id, shea._id, 8).expect(200); // counted 8 (2 missing) when the system said 10
    await changeStock({ productId: shea._id, change: -3, reason: "store_sale" }); // 3 sold afterwards → system 7
    await md.complete(id).expect(200);
    // 10 − 2 missing − 3 sold = 5 (not 8, which would undo the sale).
    expect((await Product.findById(shea._id)).stock).toBe(5);
    expect((await reconcile(shea._id)).matches).toBe(true);
  });

  it("can set products nobody counted to zero, for a full count", async () => {
    const md = api(tokenFor(await owner()));
    const shea = await product("Shea Body Butter", 10);
    const wig = await product("Bob Wig", 2, "wigs");
    const id = (await md.start({ name: "Full count" })).body._id;
    await md.set(id, shea._id, 10).expect(200);
    const done = await md.complete(id, { zeroUncounted: true });
    expect(done.body.results.find((r) => r.name === "Bob Wig")).toMatchObject({ counted: null, difference: -2, stockAfter: 0, note: "Not counted: set to 0" });
    expect((await Product.findById(wig._id)).stock).toBe(0);
    expect(done.body.totals.missingUnits).toBe(2);
  });

  it("limits a category count to that category, and +/− taps never go below 0", async () => {
    const md = api(tokenFor(await owner()));
    const shea = await product("Shea Body Butter", 10);
    const wig = await product("Bob Wig", 2, "wigs");
    const id = (await md.start({ name: "Wigs only", category: "wigs" })).body._id;
    expect((await md.scan(id, shea.barcode)).body.message).toMatch(/isn't in wigs/);
    await md.add(id, wig._id, 1).expect(200);
    const after = await md.add(id, wig._id, -5);
    expect(after.body.lines[0].counted).toBe(0);
    expect(after.body.uncounted).toEqual([]); // only wigs are expected
  });

  it("cancelling changes nothing", async () => {
    const md = api(tokenFor(await owner()));
    const shea = await product("Shea Body Butter", 10);
    const id = (await md.start({ name: "Oops" })).body._id;
    await md.set(id, shea._id, 1).expect(200);
    await md.cancel(id).expect(200);
    expect((await Product.findById(shea._id)).stock).toBe(10);
    expect((await md.complete(id)).status).toBe(400);
  });

  it("is refused to customers", async () => {
    const ada = await User.create({ name: "Ada", email: "ada@example.com", password: "password123" });
    expect((await api(generateToken(ada._id)).start({ name: "x y" })).status).toBe(401);
  });
});
