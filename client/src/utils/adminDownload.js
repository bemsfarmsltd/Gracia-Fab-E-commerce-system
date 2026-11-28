import API_URL from "../config";

// Downloads an admin spreadsheet. A plain <a href> can't send the admin's
// login token, so fetch it and save the response as a file.
// `from` / `to` are optional "YYYY-MM-DD" days (inclusive, Nigerian time).
async function downloadCsv(path, { from, to } = {}, { fallbackName, failMessage }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();

  const res = await fetch(`${API_URL}${path}${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) {
    let message = failMessage;
    try {
      message = (await res.json()).message || message;
    } catch {
      // not JSON; keep the generic message
    }
    throw new Error(message);
  }

  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

// Online orders, paid or not.
export const downloadOrdersCsv = (range) =>
  downloadCsv("/api/admin/orders/export", range, {
    fallbackName: "gracia-fab-orders.csv",
    failMessage: "Couldn't export orders",
  });

// Shop-till receipts, voided ones included and marked.
export const downloadShopSalesCsv = (range) =>
  downloadCsv("/api/admin/reports/shop-sales/export", range, {
    fallbackName: "gracia-fab-shop-sales.csv",
    failMessage: "Couldn't export shop sales",
  });
