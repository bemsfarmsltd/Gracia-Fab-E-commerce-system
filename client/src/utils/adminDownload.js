import API_URL from "../config";

// Downloads the orders spreadsheet. A plain <a href> can't send the admin's
// login token, so fetch it and save the response as a file.
// `from` / `to` are optional "YYYY-MM-DD" days (inclusive, Nigerian time).
export async function downloadOrdersCsv({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();

  const res = await fetch(`${API_URL}/api/admin/orders/export${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) {
    let message = "Couldn't export orders";
    try {
      message = (await res.json()).message || message;
    } catch {
      // not JSON; keep the generic message
    }
    throw new Error(message);
  }

  const name =
    /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] ||
    "gracia-fab-orders.csv";
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
