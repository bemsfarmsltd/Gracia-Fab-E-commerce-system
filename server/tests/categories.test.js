import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import AdminActivity from "../models/AdminActivity.js";
import generateToken from "../utils/generateToken.js";
import { slugify } from "../services/categories.js";

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
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Category.deleteMany({}), AdminActivity.deleteMany({})]);
});

const bearer = (u) => ({ Authorization: `Bearer ${generateToken(u._id, { isAdmin: true })}` });
const owner = () => User.create({ name: "MD", email: "md@example.com", password: "password123", isAdmin: true });
const staff = () => User.create({ name: "Chioma", email: "chioma@example.com", password: "password123", role: "staff" });
const product = (o = {}) => Product.create({ name: "P", description: "d", price: 1000, image: "https://res.cloudinary.com/dyzkjerez/x.jpg", category: "skincare", ...o });
const base = { name: "Glow Serum", description: "d", price: 9000, image: "https://res.cloudinary.com/dyzkjerez/x.jpg", stock: 1, tags: [] };

describe("category list", () => {
  it("starts with departments and a wide set of categories, and keeps departments products already use", async () => {
    await product({ category: "hairstyle" }); // an older department not in the starter list
    const res = await request(app).get("/api/categories").expect(200);
    const depts = res.body.map((d) => d.slug);
    expect(depts.slice(0, 6)).toEqual(["skincare", "bodycare", "haircare", "fragrance", "wig", "bridal"]);
    expect(depts).toContain("hairstyle");
    const names = res.body.flatMap((d) => d.children.map((c) => c.name));
    for (const n of ["Serums", "Face wash & cleansers", "Body wash & shower gel", "Bar soaps", "Body oils", "Tube creams", "Hair creams", "Hair relaxers", "Perfumes"]) {
      expect(names).toContain(n);
    }
    expect(res.body.find((d) => d.slug === "bodycare").children.find((c) => c.name === "Bar soaps").slug).toBe("bar-soaps");
    // Only written once: a second call doesn't duplicate.
    await request(app).get("/api/categories");
    expect(await Category.countDocuments({ slug: "serums" })).toBe(1);
  });

  it("makes tidy slugs", () => {
    expect(slugify("Face wash & cleansers")).toBe("face-wash-cleansers");
    expect(slugify("  Crème  Brûlée! ")).toBe("creme-brulee");
  });
});

describe("managing categories", () => {
  it("lets the owner add, rename, hide, reorder and delete, and logs it", async () => {
    const md = await owner();
    await request(app).get("/api/categories"); // starter list

    const added = await request(app).post("/api/admin/categories").set(bearer(md)).send({ name: "Lip care", parent: "skincare" }).expect(201);
    expect(added.body).toMatchObject({ name: "Lip care", slug: "lip-care", parent: "skincare" });
    // Same name in the same department is refused; a new department is fine.
    await request(app).post("/api/admin/categories").set(bearer(md)).send({ name: "lip CARE", parent: "skincare" }).expect(409);
    await request(app).post("/api/admin/categories").set(bearer(md)).send({ name: "Lip care", parent: "nope" }).expect(400);
    const dept = await request(app).post("/api/admin/categories").set(bearer(md)).send({ name: "Makeup" }).expect(201);
    expect(dept.body).toMatchObject({ slug: "makeup", parent: null });

    // Renaming keeps the slug, so products aren't affected.
    const renamed = await request(app).put(`/api/admin/categories/${added.body._id}`).set(bearer(md)).send({ name: "Lip balms & care" }).expect(200);
    expect(renamed.body.slug).toBe("lip-care");

    // Hidden ones leave the shop list but stay in the admin list.
    await request(app).put(`/api/admin/categories/${added.body._id}`).set(bearer(md)).send({ active: false }).expect(200);
    const shop = await request(app).get("/api/categories");
    expect(shop.body.find((d) => d.slug === "skincare").children.map((c) => c.slug)).not.toContain("lip-care");
    const admin = await request(app).get("/api/admin/categories").set(bearer(md));
    expect(admin.body.find((d) => d.slug === "skincare").children.find((c) => c.slug === "lip-care")).toMatchObject({ active: false, productCount: 0 });

    // Reorder the categories in one department.
    const skincare = admin.body.find((d) => d.slug === "skincare").children;
    const ids = skincare.map((c) => String(c._id)).reverse();
    await request(app).post("/api/admin/categories/reorder").set(bearer(md)).send({ ids }).expect(200);
    const after = (await request(app).get("/api/admin/categories").set(bearer(md))).body.find((d) => d.slug === "skincare").children;
    expect(after.map((c) => String(c._id))).toEqual(ids);
    // Mixing departments in one reorder is refused.
    const bodyId = String(admin.body.find((d) => d.slug === "bodycare").children[0]._id);
    await request(app).post("/api/admin/categories/reorder").set(bearer(md)).send({ ids: [ids[0], bodyId] }).expect(400);

    await request(app).delete(`/api/admin/categories/${added.body._id}`).set(bearer(md)).expect(200);
    // The log is written just after each response, so give the last one a moment.
    const wanted = ["category.create", "category.update", "category.reorder", "category.delete"];
    let actions = [];
    for (let i = 0; i < 100 && !wanted.every((w) => actions.includes(w)); i += 1) {
      actions = (await AdminActivity.find().lean()).map((a) => a.action);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(actions).toEqual(expect.arrayContaining(wanted));
  });

  it("won't delete a category or department that's in use", async () => {
    const md = await owner();
    await request(app).get("/api/categories");
    await product({ category: "bodycare", subcategory: "bar-soaps" });
    const tree = (await request(app).get("/api/admin/categories").set(bearer(md))).body;
    const body = tree.find((d) => d.slug === "bodycare");
    const soaps = body.children.find((c) => c.slug === "bar-soaps");
    expect(soaps.productCount).toBe(1);
    expect(body.productCount).toBe(1);

    const res = await request(app).delete(`/api/admin/categories/${soaps._id}`).set(bearer(md)).expect(409);
    expect(res.body.message).toMatch(/1 product is in "Bar soaps"/);
    await request(app).delete(`/api/admin/categories/${body._id}`).set(bearer(md)).expect(409);
    // An empty department with categories inside can't be deleted either.
    const fragrance = tree.find((d) => d.slug === "fragrance");
    await request(app).delete(`/api/admin/categories/${fragrance._id}`).set(bearer(md)).expect(409);
  });

  it("lets staff see categories but not change them", async () => {
    const s = await staff();
    await request(app).get("/api/admin/categories").set(bearer(s)).expect(200);
    await request(app).post("/api/admin/categories").set(bearer(s)).send({ name: "X", parent: "skincare" }).expect(403);
  });
});

describe("products and categories", () => {
  it("saves a product's department and category, and checks they belong together", async () => {
    const md = await owner();
    const made = await request(app).post("/api/admin/products").set(bearer(md)).send({ ...base, category: "skincare", subcategory: "serums" }).expect(201);
    expect(made.body).toMatchObject({ category: "skincare", subcategory: "serums" });

    const wrong = await request(app).post("/api/admin/products").set(bearer(md)).send({ ...base, category: "haircare", subcategory: "serums" }).expect(400);
    expect(wrong.body.errors).toEqual([{ path: "subcategory", message: "That category belongs to a different department" }]);
    const noDept = await request(app).post("/api/admin/products").set(bearer(md)).send({ ...base, category: "toys" }).expect(400);
    expect(noDept.body.errors[0].path).toBe("category");
    // No category yet is fine ("" from the form means none).
    const unsorted = await request(app).post("/api/admin/products").set(bearer(md)).send({ ...base, category: "bodycare", subcategory: "" }).expect(201);
    expect(unsorted.body.subcategory).toBe(null);

    // Moving to another department drops the old category.
    const moved = await request(app).put(`/api/admin/products/${made.body._id}`).set(bearer(md)).send({ category: "bodycare" }).expect(200);
    expect(moved.body).toMatchObject({ category: "bodycare", subcategory: null });
    // A category alone must fit the product's department.
    await request(app).put(`/api/admin/products/${made.body._id}`).set(bearer(md)).send({ subcategory: "perfumes" }).expect(400);
    const set = await request(app).put(`/api/admin/products/${made.body._id}`).set(bearer(md)).send({ subcategory: "body-oils" }).expect(200);
    expect(set.body.subcategory).toBe("body-oils");
    // Other edits leave the category alone.
    const priced = await request(app).put(`/api/admin/products/${made.body._id}`).set(bearer(md)).send({ price: 9500 }).expect(200);
    expect(priced.body.subcategory).toBe("body-oils");
  });

  it("sorts several products into a category at once, moving their department too", async () => {
    const md = await owner();
    await request(app).get("/api/categories");
    const a = await product({ name: "Black Soap", category: "skincare" });
    const b = await product({ name: "Sulphur Soap", category: "skincare" });
    const res = await request(app).post("/api/admin/categories/assign").set(bearer(md))
      .send({ productIds: [String(a._id), String(b._id)], subcategory: "bar-soaps" }).expect(200);
    expect(res.body.updated).toBe(2);
    expect(await Product.find({ subcategory: "bar-soaps", category: "bodycare" }).countDocuments()).toBe(2);
    await request(app).post("/api/admin/categories/assign").set(bearer(md)).send({ productIds: [String(a._id)], subcategory: "bodycare" }).expect(400);

    const tree = (await request(app).get("/api/admin/categories").set(bearer(md))).body;
    expect(tree.find((d) => d.slug === "skincare").unsortedCount).toBe(0);
  });
});
