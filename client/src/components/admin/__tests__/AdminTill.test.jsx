import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import AdminTill from "../AdminTill";
import { whatsappNumber, receiptText, receiptWhatsAppUrl } from "../../../utils/receipt";

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const PRODUCTS = [
  { _id: "p1", name: "Shea Body Butter", brand: "Gracia", price: 7500, stock: 2 },
  { _id: "p2", name: "Hair Oil", price: 4000, stock: 0 },
];
const OPTIONS = { paymentMethods: [{ id: "cash", label: "Cash" }, { id: "transfer", label: "Bank transfer" }, { id: "card", label: "POS card" }], canDiscount: false, canVoid: false };
const SALE = {
  _id: "s1", numberLabel: "S-000007", createdAt: "2026-11-27T10:30:00.000Z", status: "completed",
  items: [{ product: "p1", name: "Shea Body Butter", unitPrice: 7500, quantity: 2, lineTotal: 15000 }],
  subtotal: 15000, discount: 0, total: 15000, paymentMethod: "cash", amountTendered: 20000, change: 5000,
  soldByName: "Chioma", customerName: "Ada", customerPhone: "0803 000 0000",
};

function mockApi({ onSale } = {}) {
  const posted = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
    if (url.includes("/api/admin/sales/options")) return json(200, OPTIONS);
    if (url.includes("/api/admin/sales/summary")) return json(200, { byMethod: [], sales: 0, total: 0, units: 0 });
    if (url.includes("/api/admin/sales") && opts.method === "POST") {
      posted.push(JSON.parse(opts.body));
      return onSale ? onSale() : json(201, SALE);
    }
    if (url.includes("/api/admin/sales")) return json(200, { items: [] });
    if (url.includes("/api/admin/products")) return json(200, PRODUCTS);
    return json(404, {});
  });
  return posted;
}

afterEach(() => vi.restoreAllMocks());

describe("till", () => {
  it("sells within stock, works out change, sends the sale and shows the receipt", async () => {
    const posted = mockApi();
    const setAdminNotice = vi.fn();
    const setAdminError = vi.fn();
    render(<AdminTill setAdminError={setAdminError} setAdminNotice={setAdminNotice} />);

    const shea = await screen.findByRole("button", { name: /Shea Body Butter/ });
    expect(screen.getByRole("button", { name: /Hair Oil/ })).toBeDisabled(); // out of stock
    fireEvent.click(shea);
    fireEvent.click(shea);
    fireEvent.click(shea); // only 2 in stock
    expect(setAdminError).toHaveBeenLastCalledWith('Only 2 of "Shea Body Butter" in stock.');
    expect(screen.getByRole("button", { name: "One more Shea Body Butter" })).toBeDisabled();

    const complete = screen.getByRole("button", { name: /Complete sale · ₦15,000/ });
    expect(complete).toBeDisabled(); // no payment method yet
    fireEvent.click(screen.getByRole("radio", { name: "Cash" }));
    fireEvent.change(screen.getByLabelText(/Cash given/), { target: { value: "10000" } });
    expect(screen.getByText("Not enough")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Cash given/), { target: { value: "20000" } });
    expect(screen.getByText("₦5,000")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Customer details/));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0803 000 0000" } });
    fireEvent.click(complete);

    const receipt = await screen.findByLabelText("Receipt S-000007");
    expect(posted[0]).toEqual({
      items: [{ productId: "p1", quantity: 2 }], paymentMethod: "cash", amountTendered: 20000, customerName: "Ada", customerPhone: "0803 000 0000",
    });
    expect(within(receipt).getByText("Served by Chioma", { exact: false })).toBeInTheDocument();
    expect(within(receipt).getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/2348030000000\?text=/);
    expect(within(receipt).queryByRole("button", { name: "Void sale" })).toBeNull(); // staff can't void
    expect(setAdminNotice).toHaveBeenCalledWith("Sale S-000007 done: ₦15,000, give ₦5,000 change.");
  });

  it("shows the server's reason when the last item just sold online", async () => {
    mockApi({ onSale: () => json(409, { message: 'Only 0 of "Shea Body Butter" left. It may have just sold online.' }) });
    const setAdminError = vi.fn();
    render(<AdminTill setAdminError={setAdminError} setAdminNotice={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Shea Body Butter/ }));
    fireEvent.click(screen.getByRole("radio", { name: "POS card" }));
    fireEvent.click(screen.getByRole("button", { name: /Complete sale/ }));
    await waitFor(() => expect(setAdminError).toHaveBeenCalledWith('Only 0 of "Shea Body Butter" left. It may have just sold online.'));
    // The sale stays on screen so it can be fixed.
    expect(screen.getByText("This sale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "One less Shea Body Butter" })).toBeInTheDocument();
  });
});

describe("receipts", () => {
  it("turns Nigerian numbers into WhatsApp numbers", () => {
    expect(whatsappNumber("0803 744 7068")).toBe("2348037447068");
    expect(whatsappNumber("+234 803 744 7068")).toBe("2348037447068");
    expect(whatsappNumber("12345")).toBeNull();
    expect(receiptWhatsAppUrl({ ...SALE, customerPhone: "" })).toBeNull();
  });

  it("writes a plain receipt with totals, payment and change", () => {
    const text = receiptText(SALE);
    expect(text).toContain("Gracia Fab: receipt S-000007");
    expect(text).toContain("2 × Shea Body Butter: ₦15,000");
    expect(text).toContain("Total: ₦15,000");
    expect(text).toContain("Paid by Cash");
    expect(text).toContain("Change: ₦5,000");
  });
});
