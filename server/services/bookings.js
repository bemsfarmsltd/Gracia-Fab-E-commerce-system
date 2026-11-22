// Bookings calendar (redesign stage 3). Staff log appointments customers made
// on WhatsApp or by phone. Two safety checks, both overridable when staff
// really mean it ("book anyway"):
//   - outside opening hours (Mon–Sat, 8am–6pm Lagos time)
//   - the same staff member already booked at an overlapping time
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { BOOKING_SERVICES, STORE_HOURS, DEFAULT_BOOKING_MINUTES } from "../config/services.js";

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no daylight saving
const MIN = 60 * 1000;

export class BookingError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Lagos wall-clock parts of an instant.
const lagosParts = (date) => {
  const d = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), dateKey: d.toISOString().slice(0, 10) };
};

export function isWithinOpeningHours(startsAt, endsAt) {
  const s = lagosParts(startsAt);
  const e = lagosParts(endsAt);
  return (
    s.dateKey === e.dateKey &&
    STORE_HOURS.openDays.includes(s.day) &&
    s.minutes >= STORE_HOURS.openHour * 60 &&
    e.minutes <= STORE_HOURS.closeHour * 60
  );
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findClashes({ staff, startsAt, endsAt, excludeId }) {
  if (!staff) return [];
  const q = {
    staff: new RegExp(`^${escapeRegex(staff)}$`, "i"),
    status: { $ne: "cancelled" },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  };
  if (excludeId) q._id = { $ne: excludeId };
  return Booking.find(q).select("customerName service startsAt endsAt staff").lean();
}

const present = (b) => ({ ...b, serviceLabel: BOOKING_SERVICES[b.service] || b.service });

async function checkAndFill(data, { excludeId } = {}) {
  const startsAt = new Date(data.startsAt);
  const durationMinutes = data.durationMinutes ?? DEFAULT_BOOKING_MINUTES;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * MIN);

  if (data.customer) {
    if (!mongoose.isValidObjectId(data.customer) || !(await User.exists({ _id: data.customer }))) {
      throw new BookingError("That customer account wasn't found");
    }
  }
  if (data.status !== "cancelled") {
    if (!data.allowOutsideHours && !isWithinOpeningHours(startsAt, endsAt)) {
      throw new BookingError("That's outside opening hours (Monday to Saturday, 8am to 6pm).", 409, { code: "outside-hours" });
    }
    if (!data.allowClash) {
      const clashes = await findClashes({ staff: data.staff, startsAt, endsAt, excludeId });
      if (clashes.length) {
        throw new BookingError(`${data.staff} is already booked at that time.`, 409, { code: "clash", clashes: clashes.map(present) });
      }
    }
  }
  const { allowOutsideHours: _h, allowClash: _c, ...rest } = data;
  return { ...rest, startsAt, endsAt, durationMinutes };
}

export async function listBookings({ from, to, status, customer } = {}) {
  const q = {};
  if (from || to) {
    q.startsAt = {};
    if (from) q.startsAt.$gte = new Date(from);
    if (to) q.startsAt.$lt = new Date(to);
  }
  if (status) q.status = status;
  if (customer) q.customer = customer;
  const rows = await Booking.find(q).sort({ startsAt: 1 }).limit(1000).lean();
  return rows.map(present);
}

export async function createBooking(data, adminId) {
  const filled = await checkAndFill(data);
  const booking = await Booking.create({ ...filled, createdBy: adminId });
  return present(booking.toObject());
}

export async function updateBooking(id, changes) {
  if (!mongoose.isValidObjectId(id)) throw new BookingError("Booking not found", 404);
  const existing = await Booking.findById(id).lean();
  if (!existing) throw new BookingError("Booking not found", 404);
  const merged = {
    customerName: existing.customerName,
    phone: existing.phone,
    customer: existing.customer ? String(existing.customer) : undefined,
    service: existing.service,
    startsAt: existing.startsAt,
    durationMinutes: existing.durationMinutes,
    staff: existing.staff,
    notes: existing.notes,
    status: existing.status,
    ...changes,
  };
  // Only re-check the time if something affecting it changed (so marking an
  // old booking "completed" never trips the checks).
  const timeChanged = ["startsAt", "durationMinutes", "staff"].some((k) => k in changes) || (changes.status && changes.status !== "cancelled" && existing.status === "cancelled");
  const filled = timeChanged
    ? await checkAndFill(merged, { excludeId: existing._id })
    : (() => {
        const { allowOutsideHours: _h, allowClash: _c, ...rest } = merged;
        return { ...rest, endsAt: new Date(new Date(rest.startsAt).getTime() + rest.durationMinutes * MIN) };
      })();
  if (changes.customer === null || filled.customer === undefined) delete filled.customer;
  const updated = await Booking.findByIdAndUpdate(id, { $set: filled, ...(changes.customer === null ? { $unset: { customer: 1 } } : {}) }, { new: true, runValidators: true }).lean();
  return present(updated);
}

export async function deleteBooking(id) {
  if (!mongoose.isValidObjectId(id)) return false;
  return (await Booking.deleteOne({ _id: id })).deletedCount === 1;
}
