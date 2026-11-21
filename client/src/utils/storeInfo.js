// Owner-confirmed store details (21 Nov 2026), in one place for every page.
export const STORE = {
  area: "Umuahia North, Umuahia, Abia State",
  hours: "Monday to Saturday, 8am to 6pm",
  hoursShort: "Mon–Sat, 8am–6pm",
  whatsapp: "2348037447068", // wa.me format
  phone: "+2348037447068", // tel: format
  phoneDisplay: "0803 744 7068",
  // Bookings: WhatsApp first; if there's no reply within this many minutes,
  // the customer is offered a phone call.
  whatsappReplyMinutes: 30,
};

export const SERVICES = ["Hairstyle", "Wig install", "Bridal makeup", "Consultation with the MD"];

export function bookingWhatsAppUrl(service) {
  const what = service ? ` a ${service.toLowerCase()}` : " an appointment";
  const text = `Hello Gracia Fab, I'd like to book${what}. My preferred day and time: `;
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;
}

// "3:45pm" for the time the customer should call if WhatsApp hasn't replied.
export function callByTime(sentAt, minutes = STORE.whatsappReplyMinutes) {
  return new Date(sentAt + minutes * 60 * 1000)
    .toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })
    .replace(/\s/g, "")
    .toLowerCase();
}
