import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminCustomers from "../AdminCustomers";
import AdminCustomerDetail from "../AdminCustomerDetail";
import AdminBookings from "../AdminBookings";

const formatPrice = (p) => `₦${Number(p).toLocaleString()}`;

const mockCustomerListItem = {
  _id: "c11111111111111111111111",
  name: "Chisom Nwosu",
  email: "chisom@example.com",
  phone: "08031234567",
  createdAt: "2026-01-15T10:00:00.000Z",
  ordersCount: 3,
  paidOrders: 3,
  totalSpent: 95000,
  lastOrderAt: "2026-11-20T14:30:00.000Z",
  loyaltyPoints: 950,
  loyaltyTier: "silver",
};

const mockCustomerDetail = {
  customer: {
    _id: "c11111111111111111111111",
    name: "Chisom Nwosu",
    email: "chisom@example.com",
    createdAt: "2026-01-15T10:00:00.000Z",
    loyaltyPoints: 950,
    loyaltyTier: "silver",
    phone: "08031234567",
    latestAddress: {
      address: "14 Okigwe Road",
      city: "Umuahia",
      state: "Abia",
      postalCode: "440231",
      phone: "08031234567",
    },
  },
  stats: {
    ordersCount: 3,
    paidOrders: 3,
    totalSpent: 95000,
    averageOrderValue: 31667,
    firstOrderAt: "2026-02-10T12:00:00.000Z",
    lastOrderAt: "2026-11-20T14:30:00.000Z",
  },
  orders: [
    {
      _id: "ord674011111111111111111111",
      totalPrice: 45000,
      isPaid: true,
      paidAt: "2026-11-20T14:35:00.000Z",
      status: "delivered",
      createdAt: "2026-11-20T14:30:00.000Z",
      itemsCount: 2,
    },
  ],
  pointsHistory: [
    { points: 450, reason: "Order #ORD674", createdAt: "2026-11-20T14:35:00.000Z" },
  ],
  notes: [
    {
      _id: "n111111111111111111111111",
      text: "Customer prefers extra lace tinting on bridal wigs.",
      author: "Gracia",
      createdAt: "2026-11-21T09:00:00.000Z",
    },
  ],
  bookings: [
    {
      _id: "b111111111111111111111111",
      service: "bridal-makeup",
      serviceLabel: "Bridal makeup",
      startsAt: "2026-11-25T11:00:00+01:00",
      endsAt: "2026-11-25T12:00:00+01:00",
      staff: "Gracia",
      status: "booked",
    },
  ],
};

const mockBookingOptions = {
  services: [
    { id: "hairstyle", label: "Hairstyle" },
    { id: "wig-install", label: "Wig install" },
    { id: "bridal-makeup", label: "Bridal makeup" },
    { id: "md-consultation", label: "Consultation with the MD" },
  ],
  statuses: ["booked", "completed", "cancelled", "no-show"],
  hours: { openHour: 8, closeHour: 18, openDays: [1, 2, 3, 4, 5, 6], timezone: "Africa/Lagos" },
  defaultMinutes: 60,
};

const mockBookingsList = [
  {
    _id: "b111111111111111111111111",
    customerName: "Chisom Nwosu",
    phone: "08031234567",
    service: "bridal-makeup",
    serviceLabel: "Bridal makeup",
    startsAt: "2026-11-25T10:00:00+01:00",
    endsAt: "2026-11-25T11:00:00+01:00",
    durationMinutes: 60,
    staff: "Gracia",
    notes: "Lace front installation + full bridal glam",
    status: "booked",
  },
  {
    _id: "b222222222222222222222222",
    customerName: "Amaka Eze",
    phone: "08099887766",
    service: "wig-install",
    serviceLabel: "Wig install",
    startsAt: "2026-11-25T14:00:00+01:00",
    endsAt: "2026-11-25T15:00:00+01:00",
    durationMinutes: 60,
    staff: "Faith",
    notes: "",
    status: "completed",
  },
];

describe("Admin Customers & Bookings Components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* ─────────────────────────────────────────────────────────────
     ADMIN CUSTOMERS DIRECTORY
     ───────────────────────────────────────────────────────────── */
  describe("AdminCustomers Directory", () => {
    it("renders customer directory table with list data and loyalty badges", async () => {
      vi.spyOn(window, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customers: [mockCustomerListItem],
          total: 1,
          page: 1,
          pages: 1,
        }),
      });

      render(
        <AdminCustomers
          formatPrice={formatPrice}
          setAdminError={vi.fn()}
          setAdminNotice={vi.fn()}
        />
      );

      expect(screen.getByText(/Loading customers directory/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
        expect(screen.getByText("chisom@example.com")).toBeInTheDocument();
        expect(screen.getByText("08031234567")).toBeInTheDocument();
        expect(screen.getByText(/3 orders/i)).toBeInTheDocument();
        expect(screen.getByText("₦95,000")).toBeInTheDocument();
        expect(screen.getByText(/SILVER/i)).toBeInTheDocument();
      });
    });

    it("allows searching for customers by name or email", async () => {
      const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          customers: [mockCustomerListItem],
          total: 1,
          page: 1,
          pages: 1,
        }),
      });

      render(<AdminCustomers formatPrice={formatPrice} />);

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText("Search customers");
      fireEvent.change(searchInput, { target: { value: "Chisom" } });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining("search=Chisom"),
          expect.any(Object)
        );
      });
    });

    it("displays empty state when no customers match", async () => {
      vi.spyOn(window, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customers: [],
          total: 0,
          page: 1,
          pages: 1,
        }),
      });

      render(<AdminCustomers formatPrice={formatPrice} />);

      await waitFor(() => {
        expect(screen.getByText("No customers found")).toBeInTheDocument();
      });
    });
  });

  /* ─────────────────────────────────────────────────────────────
     ADMIN CUSTOMER DETAIL
     ───────────────────────────────────────────────────────────── */
  describe("AdminCustomerDetail View", () => {
    it("renders customer profile, stats, delivery address and order history", async () => {
      vi.spyOn(window, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerDetail,
      });

      render(
        <AdminCustomerDetail
          customerId="c11111111111111111111111"
          onBack={vi.fn()}
          formatPrice={formatPrice}
          setAdminError={vi.fn()}
          setAdminNotice={vi.fn()}
        />
      );

      expect(screen.getByText(/Loading customer profile/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
        expect(screen.getByText(/chisom@example.com/)).toBeInTheDocument();
        expect(screen.getByText(/Total Spend/i)).toBeInTheDocument();
        expect(screen.getByText("₦95,000")).toBeInTheDocument();
        expect(screen.getByText("14 Okigwe Road")).toBeInTheDocument();
        expect(screen.getByText(/Order History/i)).toBeInTheDocument();
        expect(screen.getByText(/Staff Notes/i)).toBeInTheDocument();
        expect(screen.getByText("Customer prefers extra lace tinting on bridal wigs.")).toBeInTheDocument();
      });
    });

    it("adds a new staff note and updates the notes thread", async () => {
      vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomerDetail,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            _id: "n222222222222222222222222",
            text: "Followed up on WhatsApp regarding next install appointment.",
            author: "Admin",
            createdAt: "2026-11-22T10:00:00.000Z",
          }),
        });

      const setAdminNotice = vi.fn();

      render(
        <AdminCustomerDetail
          customerId="c11111111111111111111111"
          onBack={vi.fn()}
          formatPrice={formatPrice}
          setAdminNotice={setAdminNotice}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Staff Notes/i)).toBeInTheDocument();
      });

      const noteTextarea = screen.getByLabelText("Add staff note");
      fireEvent.change(noteTextarea, {
        target: { value: "Followed up on WhatsApp regarding next install appointment." },
      });

      const addBtn = screen.getByText("+ Save Staff Note");
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText("Followed up on WhatsApp regarding next install appointment.")).toBeInTheDocument();
        expect(setAdminNotice).toHaveBeenCalledWith("Staff note added");
      });
    });

    it("deletes a staff note after confirmation", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomerDetail,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Note deleted" }),
        });

      const setAdminNotice = vi.fn();

      render(
        <AdminCustomerDetail
          customerId="c11111111111111111111111"
          onBack={vi.fn()}
          formatPrice={formatPrice}
          setAdminNotice={setAdminNotice}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Customer prefers extra lace tinting on bridal wigs.")).toBeInTheDocument();
      });

      const deleteNoteBtn = screen.getByLabelText("Delete staff note");
      fireEvent.click(deleteNoteBtn);

      await waitFor(() => {
        expect(screen.queryByText("Customer prefers extra lace tinting on bridal wigs.")).not.toBeInTheDocument();
        expect(setAdminNotice).toHaveBeenCalledWith("Staff note deleted");
      });
    });

    it("calls onBack when back button is clicked", async () => {
      vi.spyOn(window, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerDetail,
      });

      const onBack = vi.fn();
      render(
        <AdminCustomerDetail
          customerId="c11111111111111111111111"
          onBack={onBack}
          formatPrice={formatPrice}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("← Back to Customers Directory")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("← Back to Customers Directory"));
      expect(onBack).toHaveBeenCalled();
    });
  });

  /* ─────────────────────────────────────────────────────────────
     ADMIN BOOKINGS CALENDAR & SCHEDULE
     ───────────────────────────────────────────────────────────── */
  describe("AdminBookings Schedule & Appointments", () => {
    it("renders bookings list with service, customer, time and status", async () => {
      vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingOptions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingsList,
        });

      render(
        <AdminBookings
          setAdminError={vi.fn()}
          setAdminNotice={vi.fn()}
        />
      );

      expect(screen.getByText(/Loading scheduled appointments/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
        expect(screen.getByText("Bridal makeup")).toBeInTheDocument();
        expect(screen.getByText("08031234567")).toBeInTheDocument();
        expect(screen.getByText(/Gracia/)).toBeInTheDocument();
        expect(screen.getByText("Amaka Eze")).toBeInTheDocument();
        expect(screen.getByText("Wig install")).toBeInTheDocument();
      });
    });

    it("filters bookings when a status tab is clicked", async () => {
      const fetchSpy = vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingOptions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingsList,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockBookingsList[1]],
        });

      render(<AdminBookings />);

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
      });

      const completedTab = screen.getByRole("tab", { name: "Completed" });
      fireEvent.click(completedTab);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining("status=completed"),
          expect.any(Object)
        );
      });
    });

    it("updates booking status when action button is clicked", async () => {
      vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingOptions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingsList,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockBookingsList[0], status: "completed" }),
        });

      const setAdminNotice = vi.fn();
      render(<AdminBookings setAdminNotice={setAdminNotice} />);

      await waitFor(() => {
        expect(screen.getByText("Chisom Nwosu")).toBeInTheDocument();
      });

      const completeBtn = screen.getByTitle("Mark appointment completed");
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(setAdminNotice).toHaveBeenCalledWith("Appointment marked as completed");
      });
    });

    it("handles 409 conflict and allows staff to override with 'Book Anyway'", async () => {
      const fetchSpy = vi.spyOn(window, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingOptions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingsList,
        })
        // 409 Conflict response on first submit
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({
            message: "Gracia is already booked at that time.",
            code: "clash",
            clashes: [
              {
                customerName: "Chisom Nwosu",
                serviceLabel: "Bridal makeup",
                startsAt: "2026-11-25T10:00:00+01:00",
              },
            ],
          }),
        })
        // 201 Created on Book anyway submit
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            _id: "b33333333333333333333333",
            customerName: "Adaobi Okon",
            service: "bridal-makeup",
            serviceLabel: "Bridal makeup",
            startsAt: "2026-11-25T10:00:00+01:00",
            endsAt: "2026-11-25T11:00:00+01:00",
            status: "booked",
          }),
        })
        // Refetch bookings after creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingsList,
        });

      const setAdminNotice = vi.fn();
      render(<AdminBookings setAdminNotice={setAdminNotice} />);

      await waitFor(() => {
        expect(screen.getByText("+ New Appointment")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("+ New Appointment"));

      // Fill modal form
      fireEvent.change(screen.getByLabelText(/Customer Name \*/i), { target: { value: "Adaobi Okon" } });
      fireEvent.change(screen.getByLabelText(/Phone Number \*/i), { target: { value: "+2348011223344" } });
      fireEvent.change(screen.getByLabelText(/Staff Member/i), { target: { value: "Gracia" } });
      fireEvent.change(screen.getByLabelText(/Appointment Date \*/i), { target: { value: "2026-11-25" } });
      fireEvent.change(screen.getByLabelText(/Time/i), { target: { value: "10:00" } });

      // Click Confirm Appointment
      fireEvent.click(screen.getByText("Confirm Appointment"));

      // Conflict alert should appear with message and Book Anyway button
      await waitFor(() => {
        expect(screen.getByText("Staff Schedule Clash")).toBeInTheDocument();
        expect(screen.getByText("Gracia is already booked at that time.")).toBeInTheDocument();
        expect(screen.getByText("Book Anyway (Staff Override)")).toBeInTheDocument();
      });

      // Click Book Anyway
      fireEvent.click(screen.getByText("Book Anyway (Staff Override)"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining("/api/admin/bookings"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"allowClash":true'),
          })
        );
        expect(setAdminNotice).toHaveBeenCalledWith(
          expect.stringContaining("Appointment confirmed for Adaobi Okon")
        );
      });
    });
  });
});
