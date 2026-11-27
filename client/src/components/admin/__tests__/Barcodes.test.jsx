import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminTill from "../AdminTill";
import AdminLabels from "../AdminLabels";
import BarcodeScanner from "../BarcodeScanner";
import { gtinIsValid, barcodeFormat, codeCandidates, findProductByCode } from "../../../utils/barcode";

vi.mock("jsbarcode", () => ({ default: vi.fn() }));

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const PRODUCTS = [
  { _id: "p1", name: "Shea Body Butter", price: 7500, stock: 3, sku: "GF-000001", barcode: "4006381333931" },
  { _id: "p2", name: "Hair Oil", price: 4000, stock: 2, sku: "GF-000002", barcode: "GF-000002" },
];

function mockApi() {
  vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
    if (url.includes("/sales/options")) return json(200, { paymentMethods: [{ id: "cash", label: "Cash" }], canDiscount: false, canVoid: false });
    if (url.includes("/sales/summary")) return json(200, { byMethod: [], sales: 0, total: 0, units: 0 });
    if (url.includes("/api/admin/sales")) return json(200, { items: [] });
    if (url.includes("/barcode") && opts.method === "PUT") return json(200, { _id: "p2", sku: "GF-000002", barcode: "036000291452", barcodeType: "UPC-A" });
    if (url.includes("/api/admin/products")) return json(200, PRODUCTS);
    return json(404, {});
  });
}

afterEach(() => { vi.restoreAllMocks(); delete window.BarcodeDetector; });

describe("barcode helpers", () => {
  it("checks product barcodes and picks how to draw them", () => {
    expect(gtinIsValid("4006381333931")).toBe(true);
    expect(gtinIsValid("4006381333932")).toBe(false);
    expect(barcodeFormat("4006381333931")).toBe("EAN13");
    expect(barcodeFormat("036000291452")).toBe("UPC");
    expect(barcodeFormat("GF-000002")).toBe("CODE128");
    expect(barcodeFormat("4006381333932")).toBe("CODE128"); // bad check digit: drawn as plain code
  });

  it("matches codes typed loosely", () => {
    expect(codeCandidates("gf2")).toContain("GF-000002");
    expect(findProductByCode(PRODUCTS, " 4006381333931 ")?.name).toBe("Shea Body Butter");
    expect(findProductByCode(PRODUCTS, "gf-000002")?.name).toBe("Hair Oil");
    expect(findProductByCode(PRODUCTS, "999")).toBeNull();
  });
});

describe("scanning into the till", () => {
  it("adds a product when a code is typed or scanned by a handheld scanner (code + Enter)", async () => {
    mockApi();
    const setAdminError = vi.fn();
    render(<AdminTill setAdminError={setAdminError} setAdminNotice={vi.fn()} />);
    const box = await screen.findByLabelText("Find or scan a product");
    await screen.findByRole("button", { name: /Shea Body Butter/ });

    fireEvent.change(box, { target: { value: "4006381333931" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.change(box, { target: { value: "4006381333931" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByRole("button", { name: "One less Shea Body Butter" })).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity").textContent).toBe("2");
    expect(box.value).toBe("");

    fireEvent.change(box, { target: { value: "0000000" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(setAdminError).toHaveBeenLastCalledWith('No product has the code "0000000". Check it, or set it in Labels.');
  });

  it("adds the product the camera reads", async () => {
    mockApi();
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
    window.BarcodeDetector = class {
      static getSupportedFormats = async () => ["ean_13", "code_128"];
      detect = async () => [{ rawValue: "GF-000002" }];
    };
    render(<AdminTill setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByRole("button", { name: /Hair Oil/ });
    fireEvent.click(screen.getByRole("button", { name: /Scan/ }));
    await screen.findByRole("button", { name: "One less Hair Oil" });
    expect(screen.queryByRole("dialog", { name: "Scan a barcode" })).toBeNull(); // closes after a read
    expect(stop).toHaveBeenCalled(); // camera switched off
  });

  it("explains when the camera is refused", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => { const e = new Error("denied"); e.name = "NotAllowedError"; throw e; }) } });
    window.BarcodeDetector = class { static getSupportedFormats = async () => ["ean_13"]; detect = async () => []; };
    render(<BarcodeScanner onCode={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(/Camera access was refused/);
  });
});

describe("labels", () => {
  it("counts labels and sheets, and lets the owner set a product barcode", async () => {
    mockApi();
    vi.spyOn(window, "prompt").mockReturnValue("036000291452");
    const setAdminNotice = vi.fn();
    render(<AdminLabels user={{ isAdmin: true }} setAdminError={vi.fn()} setAdminNotice={setAdminNotice} />);
    await screen.findByText("Shea Body Butter");
    expect(screen.getByText("product barcode")).toBeInTheDocument();
    expect(screen.getByText("shop code")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "One label per item in stock" }));
    expect(screen.getByRole("button", { name: "Print 5 labels (1 sheet)" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Labels for Hair Oil"), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: "Print 33 labels (2 sheets)" })).toBeEnabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Change" })[0]); // Hair Oil (sorted by name)
    await waitFor(() => expect(setAdminNotice).toHaveBeenCalledWith('"Hair Oil" now scans as 036000291452 (UPC-A).'));
  });

  it("doesn't offer barcode changes to staff", async () => {
    mockApi();
    render(<AdminLabels user={{ role: "staff", permissions: ["stock.count"] }} setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByText("Shea Body Butter");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });
});
