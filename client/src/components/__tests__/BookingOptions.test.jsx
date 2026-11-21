import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import BookingOptions from "../BookingOptions";
import { bookingWhatsAppUrl, callByTime, STORE } from "../../utils/storeInfo";

describe("Booking by WhatsApp or phone", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T14:15:00+01:00")); // Monday 2:15pm in Nigeria
  });
  afterEach(() => vi.useRealTimers());

  it("offers WhatsApp first, with a message for the chosen service, and the phone number", () => {
    render(<BookingOptions />);
    fireEvent.change(screen.getByLabelText(/what would you like to book/i), { target: { value: "Wig install" } });
    const wa = screen.getByRole("link", { name: "Book on WhatsApp" });
    expect(wa.getAttribute("href")).toBe(bookingWhatsAppUrl("Wig install"));
    expect(decodeURIComponent(wa.getAttribute("href"))).toContain("I'd like to book a wig install");
    expect(wa.getAttribute("href")).toContain(`wa.me/${STORE.whatsapp}`);
    expect(screen.getByRole("link", { name: /call 0803 744 7068/i })).toHaveAttribute("href", "tel:+2348037447068");
    expect(screen.getByText(/within 30 minutes, please call/i)).toBeInTheDocument();
    expect(screen.getByText(/Monday to Saturday, 8am to 6pm/)).toBeInTheDocument();
  });

  it("after a WhatsApp message, says when to call, then puts the call first after 30 minutes", () => {
    const { container } = render(<BookingOptions />);
    fireEvent.click(screen.getByRole("link", { name: "Book on WhatsApp" }));
    expect(screen.getByText(callByTime(Date.now()))).toBeInTheDocument();
    expect(container.querySelector(".booking-call-first")).toBeNull();

    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    expect(screen.getByText(/still waiting for a whatsapp reply/i)).toBeInTheDocument();
    expect(container.querySelector(".booking-call-first")).not.toBeNull();
  });

  it("remembers the WhatsApp attempt if the customer comes back later", () => {
    localStorage.setItem("bookingWhatsAppSentAt", String(Date.now() - 45 * 60 * 1000));
    render(<BookingOptions compact />);
    expect(screen.getByText(/still waiting for a whatsapp reply/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what would you like to book/i)).not.toBeInTheDocument();
  });

  it("formats the call-by time for Nigeria", () => {
    expect(callByTime(new Date("2026-11-23T14:15:00+01:00").getTime())).toMatch(/2:45\s?pm/);
  });
});
