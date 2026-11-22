import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { isWithinOpeningHours } from "../services/bookings.js";

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
  await Promise.all([User.deleteMany({}), Booking.deleteMany({})]);
});

async function register(email, isAdmin = false) {
  const res = await request(app).post("/api/auth/register").send({ name: "Someone", email, password: "password123" });
  if (isAdmin) await User.updateOne({ email }, { isAdmin: true });
  return { headers: { Authorization: `Bearer ${res.body.token}` }, id: res.body._id };
}

// Tuesday 24 Nov 2026, Lagos time.
const TUE = (hhmm) => `2026-11-24T${hhmm}:00+01:00`;
const booking = (o = {}) => ({ customerName: "Ada Obi", phone: "0803 111 2222", service: "wig-install", startsAt: TUE("10:00"), staff: "Chioma", ...o });

describe("opening hours", () => {
  it("is Monday to Saturday, 8am to 6pm Lagos time", () => {
    const at = (s, mins) => [new Date(s), new Date(new Date(s).getTime() + mins * 60000)];
    expect(isWithinOpeningHours(...at(TUE("08:00"), 60))).toBe(true);
    expect(isWithinOpeningHours(...at(TUE("17:00"), 60))).toBe(true);
    expect(isWithinOpeningHours(...at(TUE("17:30"), 60))).toBe(false); // ends 6:30pm
    expect(isWithinOpeningHours(...at(TUE("07:30"), 60))).toBe(false);
    expect(isWithinOpeningHours(...at("2026-11-29T10:00:00+01:00", 60))).toBe(false); // Sunday
    expect(isWithinOpeningHours(...at("2026-11-28T10:00:00+01:00", 60))).toBe(true); // Saturday
  });
});

describe("admin bookings", () => {
  it("creates, lists by date range, updates and deletes bookings", async () => {
    const admin = await register("admin@example.com", true);
    const ada = await register("ada@example.com");

    const options = await request(app).get("/api/admin/bookings/options").set(admin.headers);
    expect(options.body.services.map((s) => s.label)).toEqual(["Hairstyle", "Wig install", "Bridal makeup", "Consultation with the MD"]);

    const created = await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ customer: ada.id, durationMinutes: 90 }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ serviceLabel: "Wig install", status: "booked", durationMinutes: 90 });
    expect(new Date(created.body.endsAt).toISOString()).toBe("2026-11-24T10:30:00.000Z");

    await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: "2026-12-01T10:00:00+01:00", service: "bridal-makeup", staff: "" }));
    const week = await request(app).get(`/api/admin/bookings?from=${encodeURIComponent(TUE("00:00"))}&to=${encodeURIComponent("2026-11-30T00:00:00+01:00")}`).set(admin.headers);
    expect(week.body).toHaveLength(1);
    expect((await request(app).get(`/api/admin/bookings?customer=${ada.id}`).set(admin.headers)).body).toHaveLength(1);

    // Marking it completed later doesn't re-run the time checks.
    const done = await request(app).put(`/api/admin/bookings/${created.body._id}`).set(admin.headers).send({ status: "completed", notes: "Lovely install" });
    expect(done.body).toMatchObject({ status: "completed", notes: "Lovely install", customerName: "Ada Obi" });

    // The customer's admin page shows their bookings.
    const detail = await request(app).get(`/api/admin/customers/${ada.id}`).set(admin.headers);
    expect(detail.body.bookings).toHaveLength(1);

    expect((await request(app).delete(`/api/admin/bookings/${created.body._id}`).set(admin.headers)).status).toBe(200);
    expect((await request(app).delete(`/api/admin/bookings/${created.body._id}`).set(admin.headers)).status).toBe(404);
  });

  it("warns about a staff double-booking, unless staff choose to book anyway", async () => {
    const admin = await register("admin@example.com", true);
    await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ durationMinutes: 120 }));

    const clash = await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("11:00"), staff: "chioma" }));
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe("clash");
    expect(clash.body.clashes[0]).toMatchObject({ customerName: "Ada Obi", serviceLabel: "Wig install" });

    // Back-to-back is fine; another stylist is fine; "book anyway" works.
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("12:00") }))).status).toBe(201);
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("11:00"), staff: "Ngozi" }))).status).toBe(201);
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("11:00"), allowClash: true }))).status).toBe(201);
    // A cancelled booking frees the slot.
    const slot = await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("15:00"), staff: "Ify" }));
    await request(app).put(`/api/admin/bookings/${slot.body._id}`).set(admin.headers).send({ status: "cancelled" });
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ startsAt: TUE("15:00"), staff: "Ify" }))).status).toBe(201);
    // Moving a booking onto someone else's slot is checked too.
    const move = await request(app).put(`/api/admin/bookings/${slot.body._id}`).set(admin.headers).send({ status: "booked", startsAt: TUE("15:30") });
    expect(move.status).toBe(409);
  });

  it("warns about times outside opening hours, unless staff choose to book anyway", async () => {
    const admin = await register("admin@example.com", true);
    const sunday = booking({ startsAt: "2026-11-29T10:00:00+01:00" });
    const res = await request(app).post("/api/admin/bookings").set(admin.headers).send(sunday);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("outside-hours");
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send({ ...sunday, allowOutsideHours: true })).status).toBe(201);
  });

  it("validates input and is admin-only", async () => {
    const admin = await register("admin@example.com", true);
    const customer = await register("c@example.com");
    for (const bad of [{ service: "massage" }, { phone: "call me" }, { startsAt: "tomorrow" }, { customerName: "" }, { durationMinutes: 5 }]) {
      expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking(bad))).status).toBe(400);
    }
    expect((await request(app).post("/api/admin/bookings").set(admin.headers).send(booking({ customer: String(new mongoose.Types.ObjectId()) }))).status).toBe(400);
    expect((await request(app).get("/api/admin/bookings?from=yesterday").set(admin.headers)).status).toBe(400);
    expect((await request(app).put(`/api/admin/bookings/${new mongoose.Types.ObjectId()}`).set(admin.headers).send({ notes: "x" })).status).toBe(404);
    expect((await request(app).get("/api/admin/bookings").set(customer.headers)).status).toBe(401);
    expect((await request(app).post("/api/admin/bookings").set(customer.headers).send(booking())).status).toBe(401);
    expect(await Booking.countDocuments()).toBe(0);
  });
});
