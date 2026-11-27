import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminStockTake from "../AdminStockTake";
import BarcodeScanner from "../BarcodeScanner";

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const PRODUCTS = [
  { _id: "p1", name: "Shea Body Butter", category: "skincare", stock: 10, sku: "GF-000001", barcode: "GF-000001" },
  { _id: "p2", name: "Bob Wig", category: "wigs", stock: 2, sku: "GF-000002", barcode: "GF-000002" },
];
const OPEN = {
  _id: "t1", name: "End of November", status: "open", startedByName: "Chioma",
  lines: [{ product: "p1", name: "Shea Body Butter", counted: 5, systemAtCount: 10, difference: -5, lastCountedBy: "Chioma" }],
  uncounted: [{ product: "p2", name: "Bob Wig", stock: 2 }],
  totals: { counted: 1, missingUnits: 5, extraUnits: 0, uncounted: 1, uncountedUnits: 2 },
};

function mockApi({ current = null } = {}) {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, opts = {}) => {
    const method = opts.method || "GET";
    calls.push([method, url.replace(/^.*\/api/, "/api"), opts.body ? JSON.parse(opts.body) : undefined]);
    if (url.endsWith("/stocktakes/current")) return json(200, current);
    if (url.endsWith("/stocktakes") && method === "GET") return json(200, { items: [] });
    if (url.endsWith("/stocktakes") && method === "POST") return json(201, { ...OPEN, name: JSON.parse(opts.body).name, lines: [], totals: { counted: 0, missingUnits: 0, extraUnits: 0, uncounted: 2, uncountedUnits: 12 }, uncounted: [] });
    if (url.includes("/scan")) return json(200, { product: { _id: "p1", name: "Shea Body Butter" }, counted: 6 });
    if (url.includes("/complete")) return json(200, { ...OPEN, status: "completed", completedByName: "Gracia MD", completedAt: "2026-11-27T12:00:00Z", results: [{ product: "p1", name: "Shea Body Butter", counted: 5, systemAtCount: 10, difference: -5, stockAfter: 5 }], totals: { products: 1, missingUnits: 5, extraUnits: 0, unchanged: 0 } });
    if (url.includes("/api/admin/products")) return json(200, PRODUCTS);
    return json(404, {});
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("stock take screen", () => {
  it("starts a count limited to a category", async () => {
    const calls = mockApi();
    render(<AdminStockTake user={{ role: "staff", permissions: ["stock.count"] }} setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Wigs Friday" } });
    fireEvent.change(screen.getByLabelText("What to count"), { target: { value: "wigs" } });
    fireEvent.click(screen.getByRole("button", { name: "Start counting" }));
    await screen.findByText(/Counting: Wigs Friday/);
    expect(calls.find(([m, u]) => m === "POST" && u === "/api/admin/stocktakes")[2]).toEqual({ name: "Wigs Friday", category: "wigs" });
  });

  it("counts a scanned code and shows the differences; staff can't approve", async () => {
    const calls = mockApi({ current: OPEN });
    render(<AdminStockTake user={{ role: "staff", permissions: ["stock.count"] }} setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByText(/Counting: End of November/);
    expect(screen.getByText("-5")).toBeInTheDocument();
    expect(screen.getByText(/1 product\(s\) not counted yet \(2 units/)).toBeInTheDocument();
    const box = screen.getByLabelText("Scan or type a code");
    fireEvent.change(box, { target: { value: "GF-000001" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("Shea Body Butter: 6 counted");
    expect(calls.some(([m, u, b]) => m === "POST" && u.endsWith("/stocktakes/t1/scan") && b.code === "GF-000001")).toBe(true);
    expect(screen.queryByRole("button", { name: "Approve and apply" })).toBeNull();
    expect(screen.getByText(/owner reviews and approves/)).toBeInTheDocument();
  });

  it("lets the owner approve as a full count and shows the report", async () => {
    const calls = mockApi({ current: OPEN });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminStockTake user={{ isAdmin: true }} setAdminError={vi.fn()} setAdminNotice={vi.fn()} />);
    await screen.findByText(/Counting: End of November/);
    fireEvent.click(screen.getByLabelText(/set products nobody counted to 0/));
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/5 unit\(s\) missing.*1 product\(s\) nobody counted \(2 units\) will be set to 0/));
    await screen.findByText(/End of November: completed/);
    expect(calls.find(([m, u]) => m === "POST" && u.endsWith("/complete"))[2]).toEqual({ zeroUncounted: true });
  });
});

describe("continuous scanning", () => {
  it("keeps reading, but ignores the same code held in front of the camera", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reads = ["GF-000001", "GF-000001", "GF-000002"];
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {} }] })) } });
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
    window.BarcodeDetector = class {
      static getSupportedFormats = async () => ["code_128"];
      detect = async () => (reads.length ? [{ rawValue: reads.shift() }] : []);
    };
    const onCode = vi.fn();
    render(<BarcodeScanner continuous onCode={onCode} onClose={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(onCode.mock.calls.map((c) => c[0])).toEqual(["GF-000001", "GF-000002"]));
    vi.useRealTimers();
    delete window.BarcodeDetector;
  });
});
