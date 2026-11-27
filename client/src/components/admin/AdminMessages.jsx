import { useState, useMemo, useEffect } from "react";
import API_URL from "../../config";
import { can } from "../../utils/portal";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "replied", label: "Replied" },
];

const formatShortDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      timeZone: "Africa/Lagos",
    });
  } catch {
    return "";
  }
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    });
  } catch {
    return "";
  }
};

const formatWhatsAppHref = (phone, name, subject) => {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `234${digits.slice(1)}`;
  }
  const greeting = `Hello ${name || "there"}, thank you for contacting Gracia Fab${subject ? ` regarding "${subject}"` : ""}. `;
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
};

export default function AdminMessages({
  user,
  messages = [],
  loading = false,
  fetchMessages,
  getHeaders,
  setAdminError,
  setAdminNotice,
}) {
  const canDeleteMessages = user === undefined ? true : can(user, "messages.delete");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const counts = useMemo(() => {
    const c = { all: messages.length, new: 0, read: 0, replied: 0 };
    messages.forEach((m) => {
      if (m.status === "new") c.new += 1;
      else if (m.status === "read") c.read += 1;
      else if (m.status === "replied") c.replied += 1;
    });
    return c;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return (messages || []).filter((msg) => {
      if (statusFilter !== "all" && msg.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const haystack = [
          msg.name,
          msg.email,
          msg.phone,
          msg.subject,
          msg.message,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [messages, statusFilter, searchTerm]);

  // Keep a valid selection on desktop when list updates
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (filteredMessages.length === 0) {
      setSelectedId(null);
      setMobileShowDetail(false);
      return;
    }
    const stillPresent = filteredMessages.some((m) => m._id === selectedId);
    if (!stillPresent) {
      setSelectedId(filteredMessages[0]._id);
    }
  }, [filteredMessages, selectedId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedMessage = useMemo(
    () => filteredMessages.find((m) => m._id === selectedId) || null,
    [filteredMessages, selectedId]
  );

  const authHeaders = () =>
    getHeaders
      ? getHeaders()
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        };

  const handleUpdateStatus = async (id, status) => {
    setUpdatingId(id);
    if (setAdminError) setAdminError("");
    if (setAdminNotice) setAdminNotice("");
    try {
      const res = await fetch(`${API_URL}/api/contact/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update message status.");
      if (setAdminNotice) {
        const label = status === "new" ? "unread" : status;
        setAdminNotice(`Message marked ${label}.`);
      }
      if (fetchMessages) await fetchMessages();
    } catch (err) {
      if (setAdminError) setAdminError(err.message || "Could not update message status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (msg) => {
    if (!window.confirm(`Delete this message from ${msg.name || "this sender"}?`)) {
      return;
    }
    setUpdatingId(msg._id);
    if (setAdminError) setAdminError("");
    if (setAdminNotice) setAdminNotice("");
    try {
      const res = await fetch(`${API_URL}/api/contact/${msg._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not delete message.");
      if (setAdminNotice) setAdminNotice("Message deleted.");
      if (selectedId === msg._id) {
        setMobileShowDetail(false);
      }
      if (fetchMessages) await fetchMessages();
    } catch (err) {
      if (setAdminError) setAdminError(err.message || "Could not delete message.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSelectMessage = (msg) => {
    setSelectedId(msg._id);
    setMobileShowDetail(true);
  };

  const whatsappHref = selectedMessage
    ? formatWhatsAppHref(
        selectedMessage.phone,
        selectedMessage.name,
        selectedMessage.subject
      )
    : null;

  return (
    <div className="admin-inbox-wrapper" data-testid="admin-messages-inbox">
      {/* Top Toolbar */}
      <div className="admin-inbox-toolbar">
        <div
          className="inbox-status-tabs"
          role="tablist"
          aria-label="Filter messages by status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              className={`inbox-filter-chip ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="inbox-chip-count">{counts[tab.id]}</span>
            </button>
          ))}
        </div>

        <div className="inbox-toolbar-right">
          <div className="inbox-search-box">
            <span className="inbox-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="inbox-search-input"
              placeholder="Search sender, subject or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search inbox messages"
            />
            {searchTerm && (
              <button
                type="button"
                className="inbox-search-clear"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {fetchMessages && (
            <button
              type="button"
              className="inbox-refresh-btn"
              onClick={fetchMessages}
              disabled={loading}
              aria-label="Refresh messages"
              title="Refresh inbox"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Main Split-Pane Inbox */}
      {loading ? (
        <div className="admin-inbox-empty">
          <p>Loading messages...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="admin-inbox-empty">
          <span className="inbox-empty-icon" aria-hidden="true">💌</span>
          <h3>No messages found</h3>
          <p>
            {searchTerm || statusFilter !== "all"
              ? "Try clearing your search or switching status filters."
              : "Customer inquiries submitted from the Contact page will appear here."}
          </p>
          {(searchTerm || statusFilter !== "all") && (
            <button
              type="button"
              className="btn-clear-filters"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={`admin-inbox-split ${mobileShowDetail ? "is-mobile-detail" : ""}`}
        >
          {/* Left Pane: Thread List */}
          <aside className="inbox-list-pane" aria-label="Message list">
            <ul className="inbox-thread-list">
              {filteredMessages.map((msg) => {
                const isSelected = msg._id === selectedId;
                const isUnread = msg.status === "new";
                const initial = (msg.name || "?").trim().charAt(0).toUpperCase();

                return (
                  <li key={msg._id} className="inbox-thread-item">
                    <button
                      type="button"
                      className={`inbox-thread-btn ${isSelected ? "is-selected" : ""} ${
                        isUnread ? "is-unread" : ""
                      }`}
                      onClick={() => handleSelectMessage(msg)}
                      aria-current={isSelected ? "true" : undefined}
                      data-testid={`inbox-item-${msg._id}`}
                    >
                      <div className="inbox-avatar" aria-hidden="true">
                        {initial}
                      </div>

                      <div className="inbox-thread-body">
                        <div className="inbox-thread-top">
                          <span className="inbox-sender-name">
                            {isUnread && (
                              <span
                                className="inbox-unread-dot"
                                aria-label="Unread"
                              />
                            )}
                            {msg.name}
                          </span>
                          <span className="inbox-thread-date">
                            {formatShortDate(msg.createdAt)}
                          </span>
                        </div>

                        <div className="inbox-thread-subject">
                          {msg.subject || "General inquiry"}
                        </div>

                        <div className="inbox-thread-bottom">
                          <span className="inbox-thread-snippet">
                            {msg.message}
                          </span>
                          <span className={`inbox-status-pill status-${msg.status}`}>
                            {msg.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Right Pane: Message Detail */}
          <section className="inbox-detail-pane" aria-label="Message detail">
            {selectedMessage ? (
              <>
                <div className="inbox-detail-mobile-bar">
                  <button
                    type="button"
                    className="inbox-back-btn"
                    onClick={() => setMobileShowDetail(false)}
                  >
                    ← Back to Inbox
                  </button>
                </div>

                <header className="inbox-detail-header">
                  <div className="inbox-detail-subject-row">
                    <h2 className="inbox-detail-subject">
                      {selectedMessage.subject || "General inquiry"}
                    </h2>
                    <span
                      className={`inbox-status-pill status-${selectedMessage.status}`}
                    >
                      {selectedMessage.status}
                    </span>
                  </div>

                  <div className="inbox-detail-sender-card">
                    <div className="inbox-avatar lg" aria-hidden="true">
                      {(selectedMessage.name || "?").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="inbox-detail-sender-meta">
                      <strong className="inbox-detail-sender-name">
                        {selectedMessage.name}
                      </strong>
                      <div className="inbox-detail-contact-links">
                        <a href={`mailto:${selectedMessage.email}`}>
                          {selectedMessage.email}
                        </a>
                        {selectedMessage.phone && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a href={`tel:${selectedMessage.phone}`}>
                              📞 {selectedMessage.phone}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <time className="inbox-detail-time">
                      {formatFullDate(selectedMessage.createdAt)}
                    </time>
                  </div>
                </header>

                <div className="inbox-detail-content">
                  <p className="inbox-detail-message">{selectedMessage.message}</p>
                </div>

                <footer className="inbox-detail-actions">
                  <div className="inbox-reply-group">
                    <a
                      href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(
                        `Re: ${selectedMessage.subject || "Your Gracia Fab inquiry"}`
                      )}`}
                      className="btn-inbox-primary"
                    >
                      ↩ Reply by Email
                    </a>

                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-inbox-secondary"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>

                  <div className="inbox-status-group">
                    {selectedMessage.status === "new" && (
                      <button
                        type="button"
                        className="btn-inbox-secondary"
                        disabled={updatingId === selectedMessage._id}
                        onClick={() =>
                          handleUpdateStatus(selectedMessage._id, "read")
                        }
                      >
                        ✓ Mark Read
                      </button>
                    )}

                    {selectedMessage.status !== "replied" && (
                      <button
                        type="button"
                        className="btn-inbox-secondary"
                        disabled={updatingId === selectedMessage._id}
                        onClick={() =>
                          handleUpdateStatus(selectedMessage._id, "replied")
                        }
                      >
                        ✓ Mark Replied
                      </button>
                    )}

                    {selectedMessage.status !== "new" && (
                      <button
                        type="button"
                        className="btn-inbox-ghost"
                        disabled={updatingId === selectedMessage._id}
                        onClick={() =>
                          handleUpdateStatus(selectedMessage._id, "new")
                        }
                      >
                        Mark Unread
                      </button>
                    )}

                    {canDeleteMessages && (
                      <button
                        type="button"
                        className="btn-inbox-delete"
                        disabled={updatingId === selectedMessage._id}
                        onClick={() => handleDelete(selectedMessage)}
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </footer>
              </>
            ) : (
              <div className="inbox-detail-placeholder">
                <p>Select a message to read its contents.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
