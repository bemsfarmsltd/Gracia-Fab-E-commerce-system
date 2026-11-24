import { randomBytes } from "node:crypto";

// A new id in the same 24-character shape as the MongoDB ids already in use
// (4 bytes of time + 8 random bytes, hex), so old and new rows look alike and
// the 8-character order numbers stay unique enough to read out on the phone.
export function newId(date = new Date()) {
  const time = Math.floor(date.getTime() / 1000).toString(16).padStart(8, "0");
  return time + randomBytes(8).toString("hex");
}

export const isId = (value) => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);
