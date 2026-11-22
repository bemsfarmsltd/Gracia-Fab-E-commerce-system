import { useState, useEffect, useCallback } from "react";
import API_URL from "../../config";

export default function AdminBookings({
  getHeaders,
  setAdminError,
  setAdminNotice,
}) {
  const [bookings, setBookings] = useState([]);
  const [options, setOptions] = useState({
    services: [
      { id: "hairstyle", label: "Hairstyle" },
      { id: "wig-install", label: "Wig install" },
      { id: "bridal-makeup", label: "Bridal makeup" },
      { id: "md-consultation", label: "Consultation with the MD" },
    ],
    statuses: ["booked", "completed", "cancelled", "no-show"],
    hours: { openHour: 8, closeHour: 18, openDays: [1, 2, 3, 4, 5, 6], timezone: "Africa/Lagos" },
    defaultMinutes: 60,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    service: "hairstyle",
    date: "",
    time: "10:00",
    durationMinutes: 60,
    staff: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(null); // { message, code, clashes }

  // Load options (services, opening hours, statuses)
  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/bookings/options`, {
        headers: getHeaders ? getHeaders() : {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.services) {
          setOptions(data);
          if (data.services.length > 0 && !form.service) {
            setForm((prev) => ({ ...prev, service: data.services[0].id }));
          }
        }
      }
    } catch {
      // Keep defaults
    }
  }, [getHeaders, form.service]);

  // Load bookings list
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API_URL}/api/admin/bookings?${params.toString()}`, {
        headers: getHeaders ? getHeaders() : {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || "Failed to load bookings");
      }

      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, getHeaders, setAdminError]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Helper to construct startsAt ISO string with Lagos +01:00 offset
  const constructStartsAt = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "";
    const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return `${dateStr}T${cleanTime}+01:00`;
  };

  const handleCreateBooking = async (overrideFlags = {}) => {
    setConflict(null);
    if (!form.customerName.trim() || !form.phone.trim() || !form.date || !form.time) {
      if (setAdminError) setAdminError("Please fill in customer name, phone, date and time.");
      return;
    }

    const startsAt = constructStartsAt(form.date, form.time);

    const payload = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      service: form.service,
      startsAt,
      durationMinutes: Number(form.durationMinutes) || options.defaultMinutes || 60,
      staff: form.staff.trim() || undefined,
      notes: form.notes.trim() || undefined,
      ...overrideFlags,
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/admin/bookings`, {
        method: "POST",
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Conflict safety check triggered (outside-hours or clash)
        setConflict({
          message: resData.message || "Booking conflict detected.",
          code: resData.code,
          clashes: resData.clashes || [],
        });
        return;
      }

      if (!res.ok) {
        throw new Error(resData.message || "Failed to create appointment.");
      }

      // Success
      if (setAdminNotice) {
        setAdminNotice(`Appointment confirmed for ${resData.customerName} (${resData.serviceLabel || resData.service})`);
      }
      setShowModal(false);
      setConflict(null);
      resetForm();
      fetchBookings();
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/bookings/${bookingId}`, {
        method: "PUT",
        headers: getHeaders ? getHeaders() : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update appointment status");
      }

      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, status: newStatus } : b))
      );
      if (setAdminNotice) setAdminNotice(`Appointment marked as ${newStatus}`);
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    }
  };

  const handleDelete = async (bookingId) => {
    if (!window.confirm("Delete this appointment entry? (For cancellations, mark as Cancelled instead)")) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/bookings/${bookingId}`, {
        method: "DELETE",
        headers: getHeaders ? getHeaders() : {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete booking");
      }

      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
      if (setAdminNotice) setAdminNotice("Appointment deleted");
    } catch (err) {
      if (setAdminError) setAdminError(err.message);
    }
  };

  const resetForm = () => {
    // Default date to today in YYYY-MM-DD
    const todayStr = new Date().toISOString().slice(0, 10);
    setForm({
      customerName: "",
      phone: "",
      service: options.services[0]?.id || "hairstyle",
      date: todayStr,
      time: "10:00",
      durationMinutes: options.defaultMinutes || 60,
      staff: "",
      notes: "",
    });
    setConflict(null);
  };

  const openNewBookingModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Filter bookings locally by search term (customer name, staff, phone)
  const filteredBookings = bookings.filter((b) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (b.customerName && b.customerName.toLowerCase().includes(term)) ||
      (b.phone && b.phone.toLowerCase().includes(term)) ||
      (b.staff && b.staff.toLowerCase().includes(term)) ||
      (b.serviceLabel && b.serviceLabel.toLowerCase().includes(term))
    );
  });

  return (
    <div className="admin-content admin-bookings-view">
      {/* ── TOOLBAR & STATS STRIP ── */}
      <div className="bookings-toolbar-card">
        <div className="bookings-toolbar-top">
          {/* Status Filters */}
          <div className="bookings-status-tabs" role="tablist" aria-label="Filter bookings by status">
            {["all", "booked", "completed", "cancelled", "no-show"].map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={statusFilter === st}
                className={`booking-tab-btn ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === "all" ? "All Bookings" : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* New Booking Action */}
          <button
            type="button"
            className="btn-admin-add"
            onClick={openNewBookingModal}
          >
            + New Appointment
          </button>
        </div>

        <div className="bookings-toolbar-bottom">
          <div className="bookings-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search by customer, phone, or staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bookings-search-input"
              aria-label="Search bookings"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                aria-label="Clear booking search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="store-hours-badge">
            <span className="hours-dot" aria-hidden="true" />
            <span>Store Hours: Mon–Sat, 8am–6pm (Lagos)</span>
          </div>
        </div>
      </div>

      {/* ── BOOKINGS SCHEDULE TABLE ── */}
      {loading ? (
        <p className="admin-loading">Loading scheduled appointments...</p>
      ) : filteredBookings.length === 0 ? (
        <div className="admin-empty-state">
          <p className="empty-title">No appointments found</p>
          <p className="empty-sub">
            {search
              ? `No bookings match "${search}".`
              : statusFilter !== "all"
              ? `No bookings with status "${statusFilter}".`
              : "No in-store or bridal appointments scheduled yet."}
          </p>
          <button
            type="button"
            className="btn-admin-save"
            onClick={openNewBookingModal}
            style={{ marginTop: "1rem" }}
          >
            + Book First Appointment
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table bookings-schedule-table">
            <thead>
              <tr>
                <th>Date &amp; Time (Lagos)</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Staff</th>
                <th>Duration</th>
                <th>Status</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => {
                const start = new Date(b.startsAt);
                const isCancelled = b.status === "cancelled";
                const isCompleted = b.status === "completed";

                return (
                  <tr key={b._id} className={isCancelled ? "row-cancelled" : ""}>
                    <td className="cell-datetime">
                      <div className="datetime-primary">
                        {start.toLocaleDateString("en-NG", {
                          timeZone: "Africa/Lagos",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="datetime-sub">
                        {start.toLocaleTimeString("en-NG", {
                          timeZone: "Africa/Lagos",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {b.endsAt && (
                          <span>
                            {" "}–{" "}
                            {new Date(b.endsAt).toLocaleTimeString("en-NG", {
                              timeZone: "Africa/Lagos",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="booking-service-tag">
                        {b.serviceLabel || b.service}
                      </span>
                    </td>

                    <td>
                      <span className="booking-customer-name font-semibold">
                        {b.customerName}
                      </span>
                      {b.notes && (
                        <div className="booking-note-snippet" title={b.notes}>
                          📝 {b.notes}
                        </div>
                      )}
                    </td>

                    <td className="cell-phone">
                      <a href={`tel:${b.phone}`} className="phone-link">
                        {b.phone}
                      </a>
                    </td>

                    <td>
                      {b.staff ? (
                        <span className="staff-pill">👤 {b.staff}</span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>

                    <td>
                      <span className="duration-pill">
                        {b.durationMinutes || 60} min
                      </span>
                    </td>

                    <td>
                      <span className={`booking-status-pill status-${b.status}`}>
                        {b.status}
                      </span>
                    </td>

                    <td className="td-actions">
                      <div className="booking-actions-group">
                        {!isCompleted && !isCancelled && (
                          <button
                            type="button"
                            className="btn-status-action btn-complete"
                            onClick={() => handleUpdateStatus(b._id, "completed")}
                            title="Mark appointment completed"
                          >
                            ✓ Done
                          </button>
                        )}
                        {!isCancelled && !isCompleted && (
                          <button
                            type="button"
                            className="btn-status-action btn-cancel-booking"
                            onClick={() => handleUpdateStatus(b._id, "cancelled")}
                            title="Cancel appointment"
                          >
                            Cancel
                          </button>
                        )}
                        {b.status === "booked" && (
                          <button
                            type="button"
                            className="btn-status-action btn-noshow"
                            onClick={() => handleUpdateStatus(b._id, "no-show")}
                            title="Mark as no-show"
                          >
                            No-show
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-delete-icon"
                          onClick={() => handleDelete(b._id)}
                          title="Delete appointment"
                          aria-label="Delete appointment"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NEW APPOINTMENT MODAL ── */}
      {showModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="admin-modal-card booking-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
          >
            <div className="admin-modal-header">
              <h3 id="booking-modal-title">New In-Store / Bridal Appointment</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Conflict Alert Banner (409 outside-hours or clash) */}
            {conflict && (
              <div className="booking-conflict-alert" role="alert">
                <div className="conflict-header">
                  <span className="conflict-icon" aria-hidden="true">⚠️</span>
                  <div className="conflict-text">
                    <strong className="conflict-title">
                      {conflict.code === "outside-hours" ? "Outside Opening Hours" : "Staff Schedule Clash"}
                    </strong>
                    <p className="conflict-message">{conflict.message}</p>
                    {conflict.clashes && conflict.clashes.length > 0 && (
                      <ul className="conflict-clashes-list">
                        {conflict.clashes.map((c, i) => (
                          <li key={i}>
                            Clashes with {c.customerName} ({c.serviceLabel || c.service}) at{" "}
                            {new Date(c.startsAt).toLocaleTimeString("en-NG", {
                              timeZone: "Africa/Lagos",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="conflict-actions">
                  <button
                    type="button"
                    className="btn-book-anyway"
                    disabled={submitting}
                    onClick={() => {
                      if (conflict.code === "outside-hours") {
                        handleCreateBooking({ allowOutsideHours: true });
                      } else if (conflict.code === "clash") {
                        handleCreateBooking({ allowClash: true });
                      } else {
                        handleCreateBooking({ allowOutsideHours: true, allowClash: true });
                      }
                    }}
                  >
                    {submitting ? "Booking..." : "Book Anyway (Staff Override)"}
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateBooking();
              }}
              className="booking-form"
            >
              <div className="booking-form-grid">
                {/* Customer Name */}
                <div className="form-group">
                  <label htmlFor="b-name">Customer Name *</label>
                  <input
                    id="b-name"
                    type="text"
                    required
                    placeholder="e.g. Chisom Nwosu"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  />
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label htmlFor="b-phone">Phone Number *</label>
                  <input
                    id="b-phone"
                    type="tel"
                    required
                    placeholder="e.g. +234 803 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                {/* Service */}
                <div className="form-group">
                  <label htmlFor="b-service">Service *</label>
                  <select
                    id="b-service"
                    value={form.service}
                    onChange={(e) => setForm({ ...form, service: e.target.value })}
                  >
                    {options.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Staff Member */}
                <div className="form-group">
                  <label htmlFor="b-staff">Staff Member</label>
                  <input
                    id="b-staff"
                    type="text"
                    placeholder="e.g. Gracia or stylist name"
                    value={form.staff}
                    onChange={(e) => setForm({ ...form, staff: e.target.value })}
                  />
                </div>

                {/* Date */}
                <div className="form-group">
                  <label htmlFor="b-date">Appointment Date *</label>
                  <input
                    id="b-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                {/* Time (Lagos time) */}
                <div className="form-group">
                  <label htmlFor="b-time">Time (Mon–Sat 8am–6pm Lagos) *</label>
                  <input
                    id="b-time"
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>

                {/* Duration */}
                <div className="form-group">
                  <label htmlFor="b-duration">Duration (minutes)</label>
                  <input
                    id="b-duration"
                    type="number"
                    min="15"
                    max="600"
                    step="15"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginTop: "0.8rem" }}>
                <label htmlFor="b-notes">Appointment Notes (optional)</label>
                <textarea
                  id="b-notes"
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Lace frontal customization, bringing own human hair bundle..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn-admin-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-admin-save"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Confirm Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
