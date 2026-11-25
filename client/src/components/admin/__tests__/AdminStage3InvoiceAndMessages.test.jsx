import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOrderInvoice from "../AdminOrderInvoice";
import AdminOrders from "../AdminOrders";
import AdminMessages from "../AdminMessages";

const formatPrice = (val) => `₦${Number(val || 0).toLocaleString()}`;

const mockPaidOrder = {
  _id: "67401111111111111111abcd",
  user: { name: "Adaeze Okafor", email: "adaeze@example.com", phone: "08012345678" },
  deliveryAddress: {
    fullName: "Adaeze Okafor",
    phone: "08012345678",
    address: "14 Aba Road",
    city: "Umuahia",
    state: "Abia",
  },
  orderItems: [
    { name: "Vitamin C Serum", quantity: 2, price: 8500 },
    { name: "Silk Bonnet", quantity: 1, price: 4000 },
  ],
  itemsPrice: 21000,
  voucher: { code: "GLOW10", discount: 2100 },
  discount: 2100,
  deliveryPrice: 2500,
  totalPrice: 21400,
  isPaid: true,
  paidAt: "2026-11-24T10:15:00.000Z",
  paymentReference: "GF-REF-9911",
  paymentResult: {
    transactionReference: "MNFY|20261124|000123",
    channel: "CARD",
  },
  status: "processing",
  createdAt: "2026-11-24T10:10:00.000Z",
};

const mockMessages = [
  {
    _id: "msg1",
    name: "Chidinma Nwosu",
    email: "chidinma@example.com",
    phone: "08022223333",
    subject: "Bridal makeup inquiry",
    message: "Hello, are you available on December 14th for bridal glam?",
    status: "new",
    createdAt: "2026-11-24T09:00:00.000Z",
  },
  {
    _id: "msg2",
    name: "Tunde Bakare",
    email: "tunde@example.com",
    subject: "Order delivery timing",
    message: "Just checking when my parcel arrives in Lagos.",
    status: "read",
    createdAt: "2026-11-23T14:30:00.000Z",
  },
  {
    _id: "msg3",
    name: "Ngozi Eze",
    email: "ngozi@example.com",
    subject: "Wig installation",
    message: "Thank you for confirming my appointment!",
    status: "replied",
    createdAt: "2026-11-22T11:00:00.000Z",
  },
];

describe("Admin Stage 3: Printable Order Invoice", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders store area, phone, customer address, items, subtotal, voucher, delivery, total, paid date, Monnify ref, and NO tax line", () => {
    render(
      <AdminOrderInvoice
        order={mockPaidOrder}
        formatPrice={formatPrice}
        onClose={vi.fn()}
      />
    );

    // Brand & real store details (no invented street address)
    expect(screen.getByText(/Umuahia North, Umuahia, Abia State/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0803 744 7068/i).length).toBeGreaterThan(0);

    // Customer & delivery details
    expect(screen.getByText("Adaeze Okafor")).toBeInTheDocument();
    expect(screen.getByText("14 Aba Road")).toBeInTheDocument();
    expect(screen.getByText("Umuahia, Abia")).toBeInTheDocument();

    // Line items
    expect(screen.getByText("Vitamin C Serum")).toBeInTheDocument();
    expect(screen.getByText("Silk Bonnet")).toBeInTheDocument();

    // Totals: subtotal, voucher discount, delivery, total
    expect(screen.getByText("₦21,000")).toBeInTheDocument();
    expect(screen.getByText(/Voucher Discount \(GLOW10\)/i)).toBeInTheDocument();
    expect(screen.getByText("−₦2,100")).toBeInTheDocument();
    expect(screen.getByText("₦2,500")).toBeInTheDocument();
    expect(screen.getByText("₦21,400")).toBeInTheDocument();

    // Monnify reference & payment info
    expect(screen.getByText("MNFY|20261124|000123")).toBeInTheDocument();

    // Must NOT include a tax / VAT line
    expect(screen.queryByText(/\b(tax|vat)\b/i)).toBeNull();
  });

  it("calls window.print() when Print / Save PDF button is clicked", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <AdminOrderInvoice
        order={mockPaidOrder}
        formatPrice={formatPrice}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("invoice-print-btn"));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the printable invoice directly from the Orders table", () => {
    render(
      <AdminOrders
        orders={[mockPaidOrder]}
        loading={false}
        fetchOrders={vi.fn()}
        handleUpdateStatus={vi.fn()}
        handleMarkRefunded={vi.fn()}
        formatPrice={formatPrice}
        setAdminError={vi.fn()}
        setAdminNotice={vi.fn()}
        getHeaders={() => ({})}
      />
    );

    const invoiceBtn = screen.getByRole("button", { name: /Invoice for order/i });
    fireEvent.click(invoiceBtn);

    expect(screen.getByTestId("admin-order-invoice")).toBeInTheDocument();
    expect(screen.getByText("MNFY|20261124|000123")).toBeInTheDocument();
  });
});

describe("Admin Stage 3: Messages Inbox", () => {
  let fetchMessages;
  let setAdminError;
  let setAdminNotice;

  beforeEach(() => {
    fetchMessages = vi.fn().mockResolvedValue();
    setAdminError = vi.fn();
    setAdminNotice = vi.fn();
    vi.restoreAllMocks();
  });

  it("renders status filter tabs with counts and displays the selected message", () => {
    render(
      <AdminMessages
        messages={mockMessages}
        loading={false}
        fetchMessages={fetchMessages}
        getHeaders={() => ({ Authorization: "Bearer tok" })}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    expect(screen.getByRole("tab", { name: /^All/i })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /^Unread/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /^Read/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /^Replied/i })).toHaveTextContent("1");

    // First message is selected by default
    expect(
      screen.getByRole("heading", { level: 2, name: "Bridal makeup inquiry" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/available on December 14th/i).length
    ).toBeGreaterThan(0);
  });

  it("filters messages by status tab and search query", () => {
    render(
      <AdminMessages
        messages={mockMessages}
        loading={false}
        fetchMessages={fetchMessages}
        getHeaders={() => ({})}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /Replied/i }));
    expect(screen.getByTestId("inbox-item-msg3")).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-item-msg1")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /All/i }));
    fireEvent.change(screen.getByLabelText("Search inbox messages"), {
      target: { value: "Lagos" },
    });
    expect(screen.getByTestId("inbox-item-msg2")).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-item-msg1")).toBeNull();
  });

  it("marks a message as read/replied and deletes after confirmation", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "read" }),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <AdminMessages
        messages={mockMessages}
        loading={false}
        fetchMessages={fetchMessages}
        getHeaders={() => ({ "Content-Type": "application/json", Authorization: "Bearer tok" })}
        setAdminError={setAdminError}
        setAdminNotice={setAdminNotice}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Mark Read/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/contact/msg1"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "read" }),
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/contact/msg1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
