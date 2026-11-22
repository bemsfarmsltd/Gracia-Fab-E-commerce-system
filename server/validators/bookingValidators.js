import { z } from "zod";
import { BOOKING_SERVICE_IDS, BOOKING_STATUSES } from "../config/services.js";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Not a valid id");
// An ISO date-time with a time zone, e.g. "2026-11-24T10:00:00+01:00".
const dateTime = z.string().datetime({ offset: true, message: "Use a full date and time" });

const fields = {
  customerName: z.string().trim().min(1, "Customer name is required").max(100),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  customer: objectId.nullable().optional(),
  service: z.enum(BOOKING_SERVICE_IDS),
  startsAt: dateTime,
  durationMinutes: z.number().int().min(15).max(600).optional(),
  staff: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  // "Book anyway" overrides for the two safety checks.
  allowOutsideHours: z.boolean().optional(),
  allowClash: z.boolean().optional(),
};

export const createBookingSchema = z.object(fields);

export const updateBookingSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const bookingListQuerySchema = z.object({
  from: dateTime.optional(),
  to: dateTime.optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  customer: objectId.optional(),
});
