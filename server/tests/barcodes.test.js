import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Counter from "../models/Counter.js";
import generateToken from "../utils/generateToken.js";
import { gtinIsValid, checkBarcode, assignSku, findByCode, formatSku } from "../services/barcodes.js";

let mongod;
beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Product.createIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Counter.deleteMany({})]);
});

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (u) => generateToken(u._id, { isAdmin: true });
const owner = () => User.create({ name: "Gracia MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = () => User.create({ name: "Chioma", email: "chioma@example.com", password: "password123", role: "staff" });
const product = (name = "Shea Body Butter") => Product.create({ name, description: "d", price: 7500, image: "/x.jpg", category: "skincare", stock: 5 });

describe("barcode rules", () => {
  it("checks the last digit of real product barcodes", () => {
    expect(gtinIsValid("4006381333931")).toBe(true); // EAN-13
    expect(gtinIsValid("4006381333932")).toBe(false);
    expect(gtinIsValid("036000291452")).toBe(true); // UPC-A
    expect(gtinIsValid("96385074")).toBe(true); // EAN-8
    expect(checkBarcode("4006 3813 3393 1")).toMatchObject({ ok: true, code: "4006381333931", type: "EAN-13" });
    expect(checkBarcode("4006381333932").message).toMatch(/doesn't check out/);
    expect(checkBarcode("gf-000012")).toMatchObject({ ok: true, code: "GF-000012", type: "Code 128" });
    expect(checkBarcode("ab").ok).toBe(false);
    expect(checkBarcode("café-1").ok).toBe(false); // not printable as Code 128
  });

  it("gives each product its own shop code, in order, without overwriting a barcode", async () => {
    const a = await product("A");
    const b = await Product.create({ name: "B", description: "d", price: 1, image: "/x", category: "skincare", barcode: "4006381333931" });
    expect(await assignSku(a._id)).toMatchObject({ sku: "GF-000001", barcode: "GF-000001" });
    expect(await assignSku(b._id)).toMatchObject({ sku: "GF-000002", barcode: "4006381333931" });
    // Again: nothing changes.
    expect((await assignSku(a._id)).sku).toBe("GF-000001");
    expect(formatSku(123)).toBe("GF-000123");
  });

  it("finds a product by barcode or by its code typed loosely", async () => {
    const a = await product();
    await assignSku(a._id);
    await Product.updateOne({ _id: a._id }, { barcode: "4006381333931" });
    for (const code of ["4006381333931", "GF-000001", "gf-000001", "GF000001", "gf1"]) {
      expect((await findByCode(code))?.name, code).toBe("Shea Body Butter");
    }
    expect(await findByCode("9999")).toBeNull();
  });
});

describe("barcode API", () => {
  it("codes new products, and lets staff look products up", async () => {
    const md = await owner();
    const created = await request(app).post("/api/admin/products").set(bearer(tokenFor(md))).send({
      name: "Bob Wig", description: "Short bob", price: 45000, image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1/x.jpg", category: "wig", stock: 2,
    }).expect(201);
    expect(created.body).toMatchObject({ sku: "GF-000001", barcode: "GF-000001" });

    const t = tokenFor(await staff());
    const found = await request(app).get("/api/admin/products/lookup?code=gf-000001").set(bearer(t)).expect(200);
    expect(found.body).toMatchObject({ name: "Bob Wig", price: 45000, stock: 2, barcodeType: "Code 128" });
    const none = await request(app).get("/api/admin/products/lookup?code=123456").set(bearer(t));
    expect(none.status).toBe(404);
    expect(none.body.message).toMatch(/No product has the code "123456"/);
  });

  it("lets the owner set a manufacturer barcode, refuses mistakes and duplicates, and resets to the shop code", async () => {
    const md = await owner();
    const t = tokenFor(md);
    const a = await product("A");
    const b = await product("B");
    await assignSku(a._id);
    await assignSku(b._id);

    const set = await request(app).put(`/api/admin/products/${a._id}/barcode`).set(bearer(t)).send({ barcode: "4006381333931" });
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({ sku: "GF-000001", barcode: "4006381333931", barcodeType: "EAN-13" });

    expect((await request(app).put(`/api/admin/products/${b._id}/barcode`).set(bearer(t)).send({ barcode: "4006381333932" })).status).toBe(400);
    const dup = await request(app).put(`/api/admin/products/${b._id}/barcode`).set(bearer(t)).send({ barcode: "4006381333931" });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/"A" already has the code/);
    // Another product's shop code can't be taken either.
    expect((await request(app).put(`/api/admin/products/${b._id}/barcode`).set(bearer(t)).send({ barcode: "GF-000001" })).status).toBe(409);

    const reset = await request(app).put(`/api/admin/products/${a._id}/barcode`).set(bearer(t)).send({ barcode: null });
    expect(reset.body.barcode).toBe("GF-000001");
  });

  it("keeps barcode changes for the owner", async () => {
    const a = await product();
    await assignSku(a._id);
    const res = await request(app).put(`/api/admin/products/${a._id}/barcode`).set(bearer(tokenFor(await staff()))).send({ barcode: "4006381333931" });
    expect(res.status).toBe(403);
  });
});
