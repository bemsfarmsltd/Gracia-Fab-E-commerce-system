// PostgreSQL (Supabase) tables for Gracia Fab — the replacement for the
// Mongoose models in server/models/. See docs/SUPABASE_MIGRATION.md.
//
// Conventions:
// - Ids are the existing 24-character MongoDB ids, kept as text, so order
//   numbers customers see (last 8 characters), email and unsubscribe links,
//   and saved carts keep working. New rows get a new id of the same shape
//   (db/ids.js).
// - Money is whole naira (integer), as everywhere in the app today.
// - Lists that reports or stock need to query get their own table (order
//   items, status history, reviews, wishlists, points). Short lists that are
//   only ever read whole are text arrays or jsonb.
// - Allowed values mirror the Mongoose enums as CHECK constraints, so a bad
//   value is refused by the database itself.
import { sql } from "drizzle-orm";
import {
  pgTable, text, integer, boolean, timestamp, jsonb, real, serial,
  primaryKey, uniqueIndex, index, check,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const ts = (name) => timestamp(name, { withTimezone: true });
const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};
const oneOf = (column, values) => sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;

export const ORDER_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];

// ── Users ────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(), // stored lower-case
    password: text("password").notNull(), // bcrypt hash
    passwordChangedAt: ts("password_changed_at"),
    avatar: text("avatar").notNull().default(""),
    authProvider: text("auth_provider").notNull().default("local"),
    otpCodeHash: text("otp_code_hash"),
    otpExpiresAt: ts("otp_expires_at"),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    skinType: text("skin_type").notNull().default("normal"),
    hairType: text("hair_type").notNull().default("straight"),
    isAdmin: boolean("is_admin").notNull().default(false),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    loyaltyTier: text("loyalty_tier").notNull().default("bronze"),
    totalSpent: integer("total_spent").notNull().default(0),
    marketingEmails: boolean("marketing_emails").notNull().default(true),
    marketingLastSent: ts("marketing_last_sent"),
    // My Vanity answers (all optional): skinType, hairType, skinConcerns[],
    // hairConcerns[], shoppingFor[], budget, undertone, weddingDate, updatedAt.
    beautyProfile: jsonb("beauty_profile"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    check("users_auth_provider_check", oneOf(t.authProvider, ["local", "google", "facebook"])),
    check("users_loyalty_tier_check", oneOf(t.loyaltyTier, ["bronze", "silver", "gold", "platinum"])),
    check("users_points_check", sql`${t.loyaltyPoints} >= 0`),
  ],
);

// ── Products ─────────────────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(),
    image: text("image").notNull(),
    secondaryImage: text("secondary_image"),
    category: text("category").notNull(),
    brand: text("brand"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    suitableSkinTypes: text("suitable_skin_types").array().notNull().default(sql`'{}'::text[]`),
    suitableHairTypes: text("suitable_hair_types").array().notNull().default(sql`'{}'::text[]`),
    suitableConcerns: text("suitable_concerns").array().notNull().default(sql`'{}'::text[]`),
    stock: integer("stock").notNull().default(0),
    isInStock: boolean("is_in_stock").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    rating: real("rating").notNull().default(0),
    numReviews: integer("num_reviews").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_featured_idx").on(t.isFeatured),
    index("products_tags_idx").using("gin", t.tags),
    check("products_price_check", sql`${t.price} >= 0`),
    // Stock can never go negative: a payment that would oversell fails.
    check("products_stock_check", sql`${t.stock} >= 0`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    skinType: text("skin_type"),
    verified: boolean("verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_product_user_key").on(t.productId, t.userId),
    check("reviews_rating_check", sql`${t.rating} between 1 and 5`),
  ],
);

// ── User lists ───────────────────────────────────────────────────────────
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0), // keeps the customer's order
    addedAt: ts("added_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const pointsHistory = pgTable(
  "points_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: text("reason"),
    type: text("type").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("points_history_user_idx").on(t.userId, t.createdAt),
    check("points_history_type_check", oneOf(t.type, ["earn", "redeem", "reversal"])),
  ],
);

// Products a customer looked at (drives the marketing emails).
export const userInterests = pgTable(
  "user_interests",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // No foreign key: a deleted product shouldn't erase what was viewed.
    productId: text("product_id"),
    category: text("category"),
    viewCount: integer("view_count").notNull().default(1),
    lastViewed: ts("last_viewed").notNull().defaultNow(),
  },
  (t) => [index("user_interests_user_idx").on(t.userId)],
);

export const savedRecommendations = pgTable(
  "saved_recommendations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: ts("date").notNull().defaultNow(),
    profile: jsonb("profile"),
    productIds: text("product_ids").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index("saved_recommendations_user_idx").on(t.userId)],
);

// ── Orders ───────────────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: id(),
    // Restrict: a customer with orders can't be deleted by accident.
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    // Delivery address, copied at checkout.
    deliveryFullName: text("delivery_full_name"),
    deliveryPhone: text("delivery_phone"),
    deliveryAddress: text("delivery_address"),
    deliveryCity: text("delivery_city"),
    deliveryState: text("delivery_state"),
    paymentReference: text("payment_reference"),
    // What Monnify confirmed: reference, transactionReference, status,
    // amount, channel, paidAt.
    paymentResult: jsonb("payment_result"),
    itemsPrice: integer("items_price").notNull(),
    voucherCode: text("voucher_code"),
    discount: integer("discount").notNull().default(0),
    deliveryPrice: integer("delivery_price").notNull(),
    totalPrice: integer("total_price").notNull(),
    status: text("status").notNull().default("pending"),
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: ts("paid_at"),
    isDelivered: boolean("is_delivered").notNull().default(false),
    deliveredAt: ts("delivered_at"),
    // What markOrderPaid took out of stock: [{ product, quantity }]. Null on
    // older orders (see services/orderCancel.js).
    stockCommitted: jsonb("stock_committed"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    refundStatus: text("refund_status").notNull().default("none"),
    refundAmount: integer("refund_amount"),
    refundReference: text("refund_reference"),
    refundNote: text("refund_note"),
    refundedAt: ts("refunded_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_payment_reference_key").on(t.paymentReference), // nulls allowed, many
    index("orders_user_created_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    check("orders_status_check", oneOf(t.status, ORDER_STATUSES)),
    check("orders_refund_status_check", oneOf(t.refundStatus, ["none", "pending", "refunded"])),
    check("orders_money_check", sql`${t.itemsPrice} >= 0 and ${t.discount} >= 0 and ${t.deliveryPrice} >= 0 and ${t.totalPrice} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    // No foreign key: an order must survive its product being deleted; the
    // name, image and price below are the copy taken at checkout.
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    image: text("image"),
    price: integer("price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
    check("order_items_quantity_check", sql`${t.quantity} >= 1`),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    changedAt: ts("changed_at").notNull().defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.changedAt)],
);

// ── Vouchers ─────────────────────────────────────────────────────────────
export const vouchers = pgTable(
  "vouchers",
  {
    id: id(),
    code: text("code").notNull(), // upper-case
    type: text("type").notNull(),
    value: integer("value").notNull(),
    maxDiscount: integer("max_discount"),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    startsAt: ts("starts_at"),
    expiresAt: ts("expires_at"),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    showOnProductPage: boolean("show_on_product_page").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("vouchers_code_key").on(t.code),
    check("vouchers_type_check", oneOf(t.type, ["percent", "fixed"])),
    check("vouchers_code_format_check", sql`${t.code} ~ '^[A-Z0-9_-]{3,30}$'`),
    check("vouchers_value_check", sql`${t.value} >= 1`),
    check("vouchers_used_check", sql`${t.usedCount} >= 0`),
  ],
);

// ── Store operations ─────────────────────────────────────────────────────
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    customerId: text("customer_id").references(() => users.id, { onDelete: "set null" }),
    service: text("service").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    staff: text("staff").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("booked"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("bookings_starts_idx").on(t.startsAt),
    index("bookings_customer_idx").on(t.customerId, t.startsAt),
    check("bookings_status_check", oneOf(t.status, ["booked", "completed", "cancelled", "no-show"])),
    check("bookings_duration_check", sql`${t.durationMinutes} between 15 and 600`),
    check("bookings_time_check", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // Keep the note if the staff member's account goes.
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [
    index("customer_notes_customer_idx").on(t.customerId),
    check("customer_notes_length_check", sql`char_length(${t.text}) <= 1000`),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    ...timestamps,
  },
  (t) => [
    index("contacts_created_idx").on(t.createdAt),
    check("contacts_status_check", oneOf(t.status, ["new", "read", "replied"])),
  ],
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: id(),
    email: text("email").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("subscribers_email_key").on(t.email)],
);

// Copy order: parents before children (foreign keys).
export const ALL_TABLES = {
  users, products, reviews, wishlistItems, pointsHistory, userInterests,
  savedRecommendations, orders, orderItems, orderStatusHistory, vouchers,
  bookings, customerNotes, contacts, subscribers,
};
