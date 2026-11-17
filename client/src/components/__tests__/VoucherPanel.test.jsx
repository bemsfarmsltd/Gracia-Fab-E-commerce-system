import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoucherPanel from "../VoucherPanel";

const vouchers = [
  {
    _id: "v1", code: "BEAUTY20", discountLabel: "20% OFF", conditionLabel: "Min spend ₦25,000",
    usedCount: 3, active: true, showOnProductPage: true,
  },
];

describe("VoucherPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.fetch = vi.fn(async (url, opts = {}) => ({
      ok: true,
      json: async () => (opts.method ? { ...vouchers[0], _id: "v2" } : vouchers),
    }));
  });

  it("lists vouchers with their real rules and usage", async () => {
    render(<VoucherPanel />);
    expect(await screen.findByText("BEAUTY20")).toBeInTheDocument();
    expect(screen.getByText("Min spend ₦25,000")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("creates a voucher with the entered rules", async () => {
    render(<VoucherPanel />);
    await screen.findByText("BEAUTY20");

    fireEvent.change(screen.getByPlaceholderText("e.g. BRIDAL10"), { target: { value: "bridal10" } });
    fireEvent.change(screen.getByLabelText(/percent off/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/minimum spend/i), { target: { value: "30000" } });
    fireEvent.click(screen.getByRole("button", { name: /create voucher/i }));

    await waitFor(() => {
      const post = window.fetch.mock.calls.find(([, o]) => o?.method === "POST");
      expect(JSON.parse(post[1].body)).toMatchObject({
        code: "BRIDAL10", type: "percent", value: 10, minSubtotal: 30000, showOnProductPage: true,
      });
    });
  });

  it("switches a voucher off", async () => {
    render(<VoucherPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /beauty20 active/i }));
    await waitFor(() => {
      const put = window.fetch.mock.calls.find(([, o]) => o?.method === "PUT");
      expect(put[0]).toMatch(/\/api\/admin\/vouchers\/v1$/);
      expect(JSON.parse(put[1].body)).toEqual({ active: false });
    });
  });
});
