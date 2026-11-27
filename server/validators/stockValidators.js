import { z } from "zod";

// Movements staff record by hand. Sales, cancellations, counts and the
// opening balance are recorded automatically elsewhere.
export const MANUAL_IN = ["received", "customer_return"];
export const MANUAL_OUT = ["damaged", "expired", "lost"];

export const stockMovementSchema = z.object({
  productId: z.string().regex(/^[0-9a-f]{24}$/, "Choose a product"),
  reason: z.enum([...MANUAL_IN, ...MANUAL_OUT, "correction"]),
  // How many units. For "correction", + adds and − removes.
  quantity: z.number().int().refine((n) => n !== 0, "Enter how many").refine((n) => Math.abs(n) <= 10000, "That's more than 10,000"),
  note: z.string().trim().max(300).optional(),
}).refine((b) => b.reason === "correction" || b.quantity > 0, { message: "Enter how many (more than 0)", path: ["quantity"] })
  .refine((b) => b.reason !== "correction" || (b.note && b.note.length >= 3), { message: "Say why for a correction", path: ["note"] });
