import { listBookings, createBooking, updateBooking, deleteBooking, BookingError } from "../services/bookings.js";
import { bookingListQuerySchema } from "../validators/bookingValidators.js";
import { BOOKING_SERVICES, BOOKING_STATUSES, STORE_HOURS, DEFAULT_BOOKING_MINUTES } from "../config/services.js";
import { sendServerError } from "../utils/httpErrors.js";

const fail = (res, error, label) => {
  if (error instanceof BookingError) {
    return res.status(error.status).json({ message: error.message, ...error.extra });
  }
  return sendServerError(res, error, label);
};

// @route GET /api/admin/bookings/options — services, statuses and hours for the form
export const getBookingOptions = (req, res) => {
  res.json({
    services: Object.entries(BOOKING_SERVICES).map(([id, label]) => ({ id, label })),
    statuses: BOOKING_STATUSES,
    hours: { ...STORE_HOURS, timezone: "Africa/Lagos" },
    defaultMinutes: DEFAULT_BOOKING_MINUTES,
  });
};

// @route GET /api/admin/bookings?from=&to=&status=&customer=
export const getBookings = async (req, res) => {
  const parsed = bookingListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  try {
    res.json(await listBookings(parsed.data));
  } catch (error) {
    return fail(res, error, "getBookings error");
  }
};

// @route POST /api/admin/bookings
export const postBooking = async (req, res) => {
  try {
    res.status(201).json(await createBooking(req.body, req.user._id));
  } catch (error) {
    return fail(res, error, "postBooking error");
  }
};

// @route PUT /api/admin/bookings/:id
export const putBooking = async (req, res) => {
  try {
    res.json(await updateBooking(req.params.id, req.body));
  } catch (error) {
    return fail(res, error, "putBooking error");
  }
};

// @route DELETE /api/admin/bookings/:id (for mistakes; normally set status "cancelled")
export const removeBooking = async (req, res) => {
  try {
    if (!(await deleteBooking(req.params.id))) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Booking deleted" });
  } catch (error) {
    return fail(res, error, "removeBooking error");
  }
};
