import { sql } from "drizzle-orm";
import * as schema from "../schema.js";

const BATCH = 500;

// Parents before children, so foreign keys are satisfied as rows arrive.
const ORDER = [
  "users", "products", "reviews", "wishlistItems", "pointsHistory", "userInterests",
  "savedRecommendations", "orders", "orderItems", "orderStatusHistory", "vouchers",
  "bookings", "customerNotes", "contacts", "subscribers",
];

const tableName = (key) => schema[key][Symbol.for("drizzle:Name")];

export async function countRows(db) {
  const counts = {};
  for (const key of ORDER) {
    const result = await db.execute(sql.raw(`select count(*)::int as n from "${tableName(key)}"`));
    counts[key] = (result.rows ?? result)[0].n;
  }
  return counts;
}

// Inserts everything in one transaction: either the whole copy lands or
// none of it does.
export async function loadRows(db, rows) {
  await db.transaction(async (tx) => {
    for (const key of ORDER) {
      const list = rows[key] || [];
      for (let i = 0; i < list.length; i += BATCH) {
        await tx.insert(schema[key]).values(list.slice(i, i + BATCH));
      }
    }
  });
}

// Empties every table (rehearsal projects only — the script guards this).
export async function wipe(db) {
  const names = ORDER.map((k) => `"${tableName(k)}"`).join(", ");
  await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}

// The same figures as transform.summarise(), but read back from Postgres.
export async function summariseDb(db) {
  const one = async (query) => {
    const result = await db.execute(sql.raw(query));
    return (result.rows ?? result)[0];
  };
  const users = await one(`select count(*)::int as n, count(*) filter (where is_admin)::int as admins, coalesce(sum(loyalty_points),0)::int as points from users`);
  const products = await one(`select count(*)::int as n, coalesce(sum(stock),0)::int as stock, count(*) filter (where is_in_stock)::int as in_stock from products`);
  const orders = await one(`select count(*)::int as n, count(*) filter (where is_paid and status <> 'cancelled')::int as paid, coalesce(sum(total_price) filter (where is_paid and status <> 'cancelled'),0)::int as revenue from orders`);
  const n = async (table) => (await one(`select count(*)::int as n from ${table}`)).n;
  return {
    users: users.n,
    admins: users.admins,
    products: products.n,
    totalStock: products.stock,
    inStock: products.in_stock,
    orders: orders.n,
    orderItems: await n("order_items"),
    paidOrders: orders.paid,
    paidRevenue: orders.revenue,
    loyaltyPoints: users.points,
    reviews: await n("reviews"),
    vouchers: await n("vouchers"),
    bookings: await n("bookings"),
    contacts: await n("contacts"),
    subscribers: await n("subscribers"),
  };
}

export function compare(expected, actual) {
  return Object.keys(expected)
    .filter((k) => expected[k] !== actual[k])
    .map((k) => `${k}: MongoDB ${expected[k]}, Postgres ${actual[k]}`);
}
