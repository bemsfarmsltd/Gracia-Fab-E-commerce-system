import mongoose from "mongoose";
import { BOOKING_SERVICE_IDS, BOOKING_STATUSES, DEFAULT_BOOKING_MINUTES } from "../config/services.js";

// An in-store appointment staff logged after a customer booked on WhatsApp or
// by phone (salon, wig install, bridal makeup, MD consultation).
const bookingSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    // Linked when the customer has an account on the site (optional).
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    service: { type: String, enum: BOOKING_SERVICE_IDS, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: DEFAULT_BOOKING_MINUTES, min: 15, max: 600 },
    staff: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: BOOKING_STATUSES, default: "booked" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

bookingSchema.index({ startsAt: 1 });
bookingSchema.index({ customer: 1, startsAt: -1 });

export default mongoose.model("Booking", bookingSchema);
