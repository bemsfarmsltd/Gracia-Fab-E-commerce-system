// In-store services that can be booked (owner-confirmed, Nov 2026). Keep the
// labels in step with SERVICES in client/src/utils/storeInfo.js.
// No per-service durations: the store hasn't given any, so each booking sets
// its own length (default 60 minutes).
export const BOOKING_SERVICES = {
  hairstyle: "Hairstyle",
  "wig-install": "Wig install",
  "bridal-makeup": "Bridal makeup",
  "md-consultation": "Consultation with the MD",
};
export const BOOKING_SERVICE_IDS = Object.keys(BOOKING_SERVICES);

export const BOOKING_STATUSES = ["booked", "completed", "cancelled", "no-show"];

// Opening hours, Africa/Lagos: Monday to Saturday, 8am to 6pm.
export const STORE_HOURS = { openDays: [1, 2, 3, 4, 5, 6], openHour: 8, closeHour: 18 };
export const DEFAULT_BOOKING_MINUTES = 60;
