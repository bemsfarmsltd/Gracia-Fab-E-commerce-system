// How customers pay at the till. To add one (e.g. "opay"), add it here; the
// till screen reads this list from the API.
export const STORE_PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "transfer", label: "Bank transfer" },
  { id: "card", label: "POS card" },
];

export const STORE_PAYMENT_METHOD_IDS = STORE_PAYMENT_METHODS.map((m) => m.id);
