import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql, eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { transformAll, summarise } from "../../db/copy/transform.js";
import { loadRows, summariseDb, compare, wipe } from "../../db/copy/load.js";
import { newId, isId } from "../../db/ids.js";
import User from "../../models/User.js";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import Review from "../../models/Review.js";
import Voucher from "../../models/Voucher.js";
import Booking from "../../models/Booking.js";
import CustomerNote from "../../models/CustomerNote.js";
import Contact from "../../models/Contact.js";
import Subscriber from "../../models/Subscriber.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, "../../db/migrations");

let mongod;
let pg;
let db;

const COLLECTIONS = {
  users: "users", products: "products", reviews: "reviews", orders: "orders",
  vouchers: "vouchers", bookings: "bookings", customerNotes: "customernotes",
  contacts: "contacts", subscribers: "subscribers",
};
const readSource = async () => {
  const source = {};
  for (const [key, c] of Object.entries(COLLECTIONS)) {
    source[key] = await mongoose.connection.db.collection(c).find({}).toArray();
  }
  return source;
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  pg = new PGlite();
  db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder });
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await pg.close();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await wipe(db);
});

async function seedStore() {
  const admin = await User.create({ name: "Store Admin", email: "Admin@Example.com", password: "password123", isAdmin: true });
  const buyer = await User.create({
    name: "Ada Buyer", email: "ada@example.com", password: "password123",
    loyaltyPoints: 120, totalSpent: 12000,
    pointsHistory: [{ points: 120, reason: "Purchase #ABCDEF12", type: "earn" }],
    emailPreferences: { marketing: false },
    beautyProfile: { skinType: "oily", skinConcerns: ["acne"], weddingDate: new Date("2027-02-14") },
  });
  const shea = await Product.create({
    name: "Shea Body Butter", description: "Whipped shea.", price: 7500, image: "/product-placeholder.svg",
    category: "skincare", tags: ["shea", "body"], suitableFor: { skinType: ["dry"], concern: ["dryness"] }, stock: 12,
  });
  const wig = await Product.create({
    name: "Bob Wig", description: "Short bob.", price: 45000, image: "/product-placeholder.svg", category: "wigs", stock: 0,
  });
  await User.updateOne({ _id: buyer._id }, {
    wishlist: [shea._id, wig._id, shea._id, new mongoose.Types.ObjectId()],
    interests: [{ productId: shea._id, category: "skincare", viewCount: 3 }],
  });
  await Review.create({ product: shea._id, user: buyer._id, name: "Ada", rating: 5, comment: "Lovely", verified: true });

  const paid = await Order.create({
    user: buyer._id,
    orderItems: [{ product: shea._id, name: "Shea Body Butter", image: "/x.jpg", price: 7500, quantity: 1 }],
    deliveryAddress: { fullName: "Ada Buyer", phone: "08030000000", address: "1 Market Rd", city: "Umuahia", state: "Abia" },
    itemsPrice: 7500, deliveryPrice: 2500, totalPrice: 10000, voucher: { code: "GLOW05", discount: 0 },
    status: "paid", isPaid: true, paidAt: new Date(), paymentReference: "GF-1",
    statusHistory: [{ status: "pending" }, { status: "paid", note: "Monnify confirmed" }],
    stockCommitted: [{ product: shea._id, quantity: 1 }],
  });
  await Order.create({
    user: buyer._id,
    orderItems: [{ product: wig._id, name: "Bob Wig", price: 45000, quantity: 2 }],
    itemsPrice: 90000, deliveryPrice: 2500, totalPrice: 92500,
    status: "cancelled", cancelReason: "Changed mind", refund: { status: "none" },
  });
  await Voucher.create({ code: "glow05", type: "percent", value: 5, showOnProductPage: true });
  await Booking.create({
    customerName: "Ada Buyer", phone: "08030000000", customer: buyer._id, service: "wig-install",
    startsAt: new Date("2026-12-01T09:00:00Z"), endsAt: new Date("2026-12-01T10:00:00Z"), createdBy: admin._id,
  });
  await CustomerNote.create({ customer: buyer._id, author: admin._id, text: "Prefers WhatsApp" });
  await Contact.create({ name: "Visitor", email: "v@example.com", message: "Do you ship to Aba?" });
  await Subscriber.create({ email: "news@example.com" });
  return { admin, buyer, shea, wig, paid };
}

describe("copying MongoDB into Postgres", () => {
  it("copies the whole store, keeps every id, and the figures match", async () => {
    const { buyer, shea, paid } = await seedStore();
    const { rows, problems, warnings } = transformAll(await readSource());

    expect(problems).toEqual([]);
    expect(warnings.some((w) => w.includes("no longer exists"))).toBe(true); // the dangling wishlist entry

    await loadRows(db, rows);
    const expected = summarise(rows);
    expect(compare(expected, await summariseDb(db))).toEqual([]);
    expect(expected).toMatchObject({ users: 2, admins: 1, products: 2, orders: 2, paidOrders: 1, paidRevenue: 10000, totalStock: 12, inStock: 1 });

    // Same ids, so the order number customers were given still finds it.
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, String(paid._id)));
    expect(order.id.slice(-8).toUpperCase()).toBe(String(paid._id).slice(-8).toUpperCase());
    expect(order).toMatchObject({ totalPrice: 10000, isPaid: true, voucherCode: "GLOW05", deliveryCity: "Umuahia", paymentReference: "GF-1" });
    expect(order.stockCommitted).toEqual([{ product: String(shea._id), quantity: 1 }]);

    const history = await db.select().from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, order.id));
    expect(history.map((h) => h.status)).toEqual(["pending", "paid"]);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, String(buyer._id)));
    expect(user).toMatchObject({ email: "ada@example.com", loyaltyPoints: 120, marketingEmails: false });
    expect(user.password).toMatch(/^\$2[aby]\$/); // the bcrypt hash moves as-is: passwords keep working
    expect(user.beautyProfile).toMatchObject({ skinType: "oily", skinConcerns: ["acne"] });

    // Duplicates and the deleted product drop out; the customer's order stays.
    const wishlist = await db.select().from(schema.wishlistItems).where(eq(schema.wishlistItems.userId, user.id));
    expect(wishlist.sort((a, b) => a.position - b.position).map((w) => w.productId)).toHaveLength(2);

    const [admin] = await db.select().from(schema.users).where(eq(schema.users.isAdmin, true));
    expect(admin.email).toBe("admin@example.com");
    const [voucher] = await db.select().from(schema.vouchers);
    expect(voucher.code).toBe("GLOW05");
  }, 60000);

  it("is all or nothing: a row the database refuses leaves the tables empty", async () => {
    await seedStore();
    const { rows } = transformAll(await readSource());
    rows.orders[1].status = "teleported"; // breaks the status rule
    await expect(loadRows(db, rows)).rejects.toThrow();
    const result = await db.execute(sql`select count(*)::int as n from users`);
    expect(result.rows[0].n).toBe(0);
  }, 60000);
});

describe("what the copy refuses to guess", () => {
  const base = { _id: new mongoose.Types.ObjectId(), name: "A", email: "a@example.com", password: "$2a$10$x" };

  it("stops on amounts that aren't whole naira", () => {
    const { problems } = transformAll({
      users: [base],
      products: [{ _id: new mongoose.Types.ObjectId(), name: "P", description: "d", price: 7499.5, image: "/x", category: "skincare" }],
    });
    expect(problems.join()).toMatch(/not a whole number of naira/);
  });

  it("stops on two accounts whose emails differ only by capitals", () => {
    const { problems } = transformAll({ users: [base, { ...base, _id: new mongoose.Types.ObjectId(), email: "A@Example.com" }] });
    expect(problems.join()).toMatch(/share the email/);
  });

  it("stops on an order whose customer is gone", () => {
    const { problems } = transformAll({
      users: [],
      orders: [{ _id: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(), itemsPrice: 1, deliveryPrice: 0, totalPrice: 1 }],
    });
    expect(problems.join()).toMatch(/customer .* doesn't exist/);
  });
});

describe("the Postgres tables themselves", () => {
  it("refuse negative stock and impossible ratings", async () => {
    const id = newId();
    await db.insert(schema.products).values({ id, name: "P", description: "d", price: 100, image: "/x", category: "skincare", stock: 1 });
    await expect(db.execute(sql`update products set stock = stock - 2 where id = ${id}`)).rejects.toThrow();
    const userId = newId();
    await db.insert(schema.users).values({ id: userId, name: "U", email: "u@example.com", password: "h" });
    await expect(db.insert(schema.reviews).values({ id: newId(), productId: id, userId, name: "U", rating: 6, comment: "x" })).rejects.toThrow();
  });

  it("close Supabase's public web API on every table", async () => {
    const result = await db.execute(sql`select relname, relrowsecurity from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace`);
    const tables = result.rows.filter((r) => !r.relname.startsWith("__drizzle"));
    expect(tables).toHaveLength(Object.keys(schema.ALL_TABLES).length);
    expect(tables.every((r) => r.relrowsecurity)).toBe(true);
  });

  it("new ids look like the old ones", () => {
    const id = newId();
    expect(isId(id)).toBe(true);
    expect(isId(String(new mongoose.Types.ObjectId()))).toBe(true);
  });
});
