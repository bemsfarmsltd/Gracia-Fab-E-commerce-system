// Turns MongoDB documents (read with .lean()) into rows for the Postgres
// tables in db/schema.js. Pure functions: no database access, so they can be
// tested on their own and run as a dry run.
//
// Anything that can't be copied faithfully is reported, never silently
// changed: `problems` stop the copy, `warnings` are listed in the report
// (e.g. a wishlist entry pointing at a product that no longer exists).

const str = (v) => (v === undefined || v === null ? null : String(v));
const date = (v) => (v ? new Date(v) : null);
const arr = (v) => (Array.isArray(v) ? v : []);
const strArr = (v) => arr(v).filter((x) => x !== null && x !== undefined && x !== "").map(String);

// Time an ObjectId was made, for old documents without createdAt.
export const idTime = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
const created = (d) => date(d.createdAt) || idTime(d._id);
const updated = (d) => date(d.updatedAt) || created(d);

export function makeCopy() {
  const rows = {
    users: [], products: [], reviews: [], wishlistItems: [], pointsHistory: [],
    userInterests: [], savedRecommendations: [], orders: [], orderItems: [],
    orderStatusHistory: [], vouchers: [], bookings: [], customerNotes: [],
    contacts: [], subscribers: [],
  };
  const problems = [];
  const warnings = [];

  // Whole naira only. A fraction would mean the app stored something it
  // never shows; stop and look rather than round it away.
  const money = (value, where, { optional = false } = {}) => {
    if (value === undefined || value === null) {
      if (!optional) problems.push(`${where}: missing amount`);
      return optional ? null : 0;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      problems.push(`${where}: amount ${value} is not a whole number of naira`);
      return Math.round(n) || 0;
    }
    return n;
  };
  const count = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };

  return { rows, problems, warnings, money, count };
}

export function transformAll(source) {
  const copy = makeCopy();
  const { rows, problems, warnings, money, count } = copy;

  const userIds = new Set(arr(source.users).map((u) => String(u._id)));
  const productIds = new Set(arr(source.products).map((p) => String(p._id)));

  // ── Users and their lists
  for (const u of arr(source.users)) {
    const id = String(u._id);
    if (!u.password) problems.push(`user ${id}: no password hash`);
    rows.users.push({
      id,
      name: u.name ?? "",
      email: String(u.email || "").trim().toLowerCase(),
      password: u.password ?? "",
      passwordChangedAt: date(u.passwordChangedAt),
      avatar: u.avatar ?? "",
      authProvider: u.authProvider || "local",
      otpCodeHash: str(u.otpCodeHash),
      otpExpiresAt: date(u.otpExpiresAt),
      otpAttempts: count(u.otpAttempts),
      skinType: u.skinType || "normal",
      hairType: u.hairType || "straight",
      isAdmin: Boolean(u.isAdmin),
      loyaltyPoints: count(u.loyaltyPoints),
      loyaltyTier: u.loyaltyTier || "bronze",
      totalSpent: money(u.totalSpent ?? 0, `user ${id} totalSpent`),
      marketingEmails: u.emailPreferences?.marketing !== false,
      marketingLastSent: date(u.emailPreferences?.lastSent),
      beautyProfile: u.beautyProfile && Object.keys(u.beautyProfile).length ? u.beautyProfile : null,
      createdAt: created(u),
      updatedAt: updated(u),
    });

    const seen = new Set();
    arr(u.wishlist).forEach((p) => {
      const productId = String(p);
      if (seen.has(productId)) return; // duplicates collapse to one
      seen.add(productId);
      if (!productIds.has(productId)) {
        warnings.push(`user ${id}: wishlist product ${productId} no longer exists, left out`);
        return;
      }
      rows.wishlistItems.push({ userId: id, productId, position: seen.size - 1, addedAt: created(u) });
    });

    for (const h of arr(u.pointsHistory)) {
      rows.pointsHistory.push({
        userId: id,
        points: count(h.points),
        reason: str(h.reason),
        type: h.type || (count(h.points) < 0 ? "redeem" : "earn"),
        createdAt: date(h.createdAt) || created(u),
      });
    }

    for (const i of arr(u.interests)) {
      rows.userInterests.push({
        userId: id,
        productId: str(i.productId),
        category: str(i.category),
        viewCount: count(i.viewCount, 1),
        lastViewed: date(i.lastViewed) || created(u),
      });
    }

    for (const r of arr(u.savedRecommendations)) {
      rows.savedRecommendations.push({
        userId: id,
        date: date(r.date) || created(u),
        profile: r.profile ?? null,
        productIds: strArr(r.products),
      });
    }
  }

  // ── Products
  for (const p of arr(source.products)) {
    const id = String(p._id);
    const stock = Math.max(0, count(p.stock));
    if (count(p.stock) < 0) warnings.push(`product ${id}: negative stock ${p.stock} copied as 0`);
    rows.products.push({
      id,
      name: p.name ?? "",
      description: p.description ?? "",
      price: money(p.price, `product ${id} price`),
      image: p.image ?? "",
      secondaryImage: str(p.secondaryImage),
      category: p.category ?? "",
      brand: str(p.brand),
      tags: strArr(p.tags),
      suitableSkinTypes: strArr(p.suitableFor?.skinType),
      suitableHairTypes: strArr(p.suitableFor?.hairType),
      suitableConcerns: strArr(p.suitableFor?.concern),
      stock,
      // Same rule as the Mongoose hook: in stock means stock above 0.
      isInStock: stock > 0,
      isFeatured: Boolean(p.isFeatured),
      rating: Number(p.rating) || 0,
      numReviews: count(p.numReviews),
      createdAt: created(p),
      updatedAt: updated(p),
    });
  }

  // ── Reviews: the Review collection, plus any old reviews embedded in a
  // product (one per customer per product; the collection's copy wins).
  const reviewKeys = new Set();
  const addReview = (r, productId, origin) => {
    const userId = str(r.user);
    const key = `${productId}:${userId}`;
    if (reviewKeys.has(key)) return;
    if (!productIds.has(productId) || !userIds.has(userId)) {
      warnings.push(`${origin} ${r._id}: its product or customer no longer exists, left out`);
      return;
    }
    const rating = count(r.rating);
    if (rating < 1 || rating > 5) {
      problems.push(`${origin} ${r._id}: rating ${r.rating} is outside 1 to 5`);
      return;
    }
    reviewKeys.add(key);
    rows.reviews.push({
      id: String(r._id),
      productId,
      userId,
      name: r.name ?? "",
      rating,
      comment: r.comment ?? "",
      skinType: str(r.skinType),
      verified: Boolean(r.verified),
      createdAt: created(r),
      updatedAt: updated(r),
    });
  };
  for (const r of arr(source.reviews)) addReview(r, str(r.product), "review");
  for (const p of arr(source.products)) {
    for (const r of arr(p.reviews)) addReview(r, String(p._id), "embedded review on product");
  }

  // ── Orders
  const paymentRefs = new Map();
  for (const o of arr(source.orders)) {
    const id = String(o._id);
    const userId = str(o.user);
    if (!userIds.has(userId)) problems.push(`order ${id}: its customer ${userId} doesn't exist`);
    if (o.paymentReference) {
      if (paymentRefs.has(o.paymentReference)) {
        problems.push(`order ${id}: payment reference also used by order ${paymentRefs.get(o.paymentReference)}`);
      }
      paymentRefs.set(o.paymentReference, id);
    }
    const a = o.deliveryAddress || {};
    rows.orders.push({
      id,
      userId,
      deliveryFullName: str(a.fullName),
      deliveryPhone: str(a.phone),
      deliveryAddress: str(a.address),
      deliveryCity: str(a.city),
      deliveryState: str(a.state),
      paymentReference: str(o.paymentReference),
      paymentResult: o.paymentResult && Object.keys(o.paymentResult).length ? o.paymentResult : null,
      itemsPrice: money(o.itemsPrice, `order ${id} itemsPrice`),
      voucherCode: str(o.voucher?.code),
      discount: money(o.discount ?? o.voucher?.discount ?? 0, `order ${id} discount`),
      deliveryPrice: money(o.deliveryPrice, `order ${id} deliveryPrice`),
      totalPrice: money(o.totalPrice, `order ${id} totalPrice`),
      status: o.status || "pending",
      isPaid: Boolean(o.isPaid),
      paidAt: date(o.paidAt),
      isDelivered: Boolean(o.isDelivered),
      deliveredAt: date(o.deliveredAt),
      stockCommitted: Array.isArray(o.stockCommitted)
        ? o.stockCommitted.map((s) => ({ product: str(s.product), quantity: count(s.quantity) }))
        : null,
      cancelledAt: date(o.cancelledAt),
      cancelReason: str(o.cancelReason),
      refundStatus: o.refund?.status || "none",
      refundAmount: money(o.refund?.amount, `order ${id} refund`, { optional: true }),
      refundReference: str(o.refund?.reference),
      refundNote: str(o.refund?.note),
      refundedAt: date(o.refund?.refundedAt),
      createdAt: created(o),
      updatedAt: updated(o),
    });

    arr(o.orderItems).forEach((item, position) => {
      const quantity = count(item.quantity);
      if (quantity < 1) problems.push(`order ${id} item ${position + 1}: quantity ${item.quantity}`);
      rows.orderItems.push({
        orderId: id,
        position,
        productId: str(item.product) ?? "",
        name: item.name ?? "",
        image: str(item.image),
        price: money(item.price, `order ${id} item ${position + 1} price`),
        quantity,
      });
    });

    for (const h of arr(o.statusHistory)) {
      rows.orderStatusHistory.push({
        orderId: id,
        status: h.status || o.status || "pending",
        note: str(h.note),
        changedAt: date(h.changedAt) || created(o),
      });
    }
  }

  // ── Vouchers
  for (const v of arr(source.vouchers)) {
    const id = String(v._id);
    rows.vouchers.push({
      id,
      code: String(v.code || "").trim().toUpperCase(),
      type: v.type,
      // value is a percentage for "percent", naira for "fixed".
      value: v.type === "fixed" ? money(v.value, `voucher ${v.code} value`) : count(v.value),
      maxDiscount: money(v.maxDiscount, `voucher ${v.code} maxDiscount`, { optional: true }),
      minSubtotal: money(v.minSubtotal ?? 0, `voucher ${v.code} minSubtotal`),
      firstOrderOnly: Boolean(v.firstOrderOnly),
      startsAt: date(v.startsAt),
      expiresAt: date(v.expiresAt),
      usageLimit: v.usageLimit === undefined || v.usageLimit === null ? null : count(v.usageLimit),
      usedCount: count(v.usedCount),
      active: v.active !== false,
      showOnProductPage: Boolean(v.showOnProductPage),
      createdAt: created(v),
      updatedAt: updated(v),
    });
  }

  // ── Bookings, notes, messages, subscribers
  const optionalUser = (value, where) => {
    const userId = str(value);
    if (userId && !userIds.has(userId)) {
      warnings.push(`${where}: linked account ${userId} no longer exists, link removed`);
      return null;
    }
    return userId;
  };
  for (const b of arr(source.bookings)) {
    const id = String(b._id);
    rows.bookings.push({
      id,
      customerName: b.customerName ?? "",
      phone: b.phone ?? "",
      customerId: optionalUser(b.customer, `booking ${id}`),
      service: b.service,
      startsAt: date(b.startsAt),
      endsAt: date(b.endsAt),
      durationMinutes: count(b.durationMinutes, 60),
      staff: b.staff ?? "",
      notes: b.notes ?? "",
      status: b.status || "booked",
      createdById: optionalUser(b.createdBy, `booking ${id} (created by)`),
      createdAt: created(b),
      updatedAt: updated(b),
    });
  }
  for (const n of arr(source.customerNotes)) {
    const id = String(n._id);
    const customerId = str(n.customer);
    if (!userIds.has(customerId)) {
      warnings.push(`customer note ${id}: its customer no longer exists, left out`);
      continue;
    }
    rows.customerNotes.push({
      id,
      customerId,
      authorId: optionalUser(n.author, `customer note ${id} (author)`),
      text: n.text ?? "",
      createdAt: created(n),
      updatedAt: updated(n),
    });
  }
  for (const c of arr(source.contacts)) {
    rows.contacts.push({
      id: String(c._id),
      name: c.name ?? "",
      email: c.email ?? "",
      phone: str(c.phone),
      subject: str(c.subject),
      message: c.message ?? "",
      status: c.status || "new",
      createdAt: created(c),
      updatedAt: updated(c),
    });
  }
  const subscriberEmails = new Set();
  for (const s of arr(source.subscribers)) {
    const email = String(s.email || "").trim().toLowerCase();
    if (subscriberEmails.has(email)) {
      warnings.push(`subscriber ${email}: listed twice, kept once`);
      continue;
    }
    subscriberEmails.add(email);
    rows.subscribers.push({ id: String(s._id), email, createdAt: created(s), updatedAt: updated(s) });
  }

  // Two accounts whose emails differ only by case would clash on the unique
  // email in Postgres.
  const emails = new Map();
  for (const u of rows.users) {
    if (emails.has(u.email)) problems.push(`users ${emails.get(u.email)} and ${u.id} share the email ${u.email}`);
    emails.set(u.email, u.id);
  }

  return copy;
}

// Figures that must be identical before and after the copy.
export function summarise(rows) {
  const sum = (list, field) => list.reduce((t, r) => t + (Number(r[field]) || 0), 0);
  const paid = rows.orders.filter((o) => o.isPaid && o.status !== "cancelled");
  return {
    users: rows.users.length,
    admins: rows.users.filter((u) => u.isAdmin).length,
    products: rows.products.length,
    totalStock: sum(rows.products, "stock"),
    inStock: rows.products.filter((p) => p.isInStock).length,
    orders: rows.orders.length,
    orderItems: rows.orderItems.length,
    paidOrders: paid.length,
    paidRevenue: sum(paid, "totalPrice"),
    loyaltyPoints: sum(rows.users, "loyaltyPoints"),
    reviews: rows.reviews.length,
    vouchers: rows.vouchers.length,
    bookings: rows.bookings.length,
    contacts: rows.contacts.length,
    subscribers: rows.subscribers.length,
  };
}
