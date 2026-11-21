import { useEffect, useState } from "react";
import { STORE, SERVICES, bookingWhatsAppUrl, callByTime } from "../utils/storeInfo";
import "./BookingOptions.css";

// Book a salon, bridal or consultation appointment: WhatsApp first. Once the
// customer has sent a WhatsApp message, the page tells them when to call if
// there's no reply (the store's 30-minute rule) and, after that, puts the
// phone call first.
const KEY = "bookingWhatsAppSentAt";
const readSentAt = () => {
  try {
    const t = Number(localStorage.getItem(KEY));
    // Only today's attempt counts.
    return t && Date.now() - t < 12 * 60 * 60 * 1000 ? t : null;
  } catch {
    return null;
  }
};

function BookingOptions({ compact = false }) {
  const [service, setService] = useState("");
  const [sentAt, setSentAt] = useState(readSentAt);
  const [now, setNow] = useState(() => Date.now());
  const waitedLongEnough = sentAt && now - sentAt >= STORE.whatsappReplyMinutes * 60 * 1000;

  // Re-check every minute so the call option comes forward at the 30-minute mark.
  useEffect(() => {
    if (!sentAt || waitedLongEnough) return undefined;
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [sentAt, waitedLongEnough]);

  const onWhatsApp = () => {
    const t = Date.now();
    setSentAt(t);
    setNow(t);
    try {
      localStorage.setItem(KEY, String(t));
    } catch {
      /* private mode: the reminder just won't persist */
    }
  };

  return (
    <div className={`booking-options${compact ? " booking-options-compact" : ""}`}>
      {!compact && (
        <label className="booking-service">
          <span>What would you like to book?</span>
          <select id="booking-service" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Choose (optional)</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      )}

      <div className={`booking-buttons${waitedLongEnough ? " booking-call-first" : ""}`}>
        <a
          className="booking-btn booking-btn-whatsapp"
          href={bookingWhatsAppUrl(service)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWhatsApp}
        >
          Book on WhatsApp
        </a>
        <a className="booking-btn booking-btn-call" href={`tel:${STORE.phone}`}>
          Call {STORE.phoneDisplay}
        </a>
      </div>

      <p className="booking-note" role="status">
        {!sentAt && <>If we haven&apos;t replied on WhatsApp within {STORE.whatsappReplyMinutes} minutes, please call us. Open {STORE.hours}.</>}
        {sentAt && !waitedLongEnough && (
          <>Thanks! No reply on WhatsApp by <strong>{callByTime(sentAt)}</strong>? Call us on {STORE.phoneDisplay}.</>
        )}
        {waitedLongEnough && (
          <>Still waiting for a WhatsApp reply? Please call us on <strong>{STORE.phoneDisplay}</strong>.</>
        )}
      </p>
    </div>
  );
}

export default BookingOptions;
