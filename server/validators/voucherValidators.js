import { z } from "zod";

// Checkout preview: "what would this code take off?" The order itself is
// re-priced on the server, so `subtotal` here only drives the preview.
export const validateVoucherSchema = z.object({
  code: z.string().trim().min(1, "Enter a voucher code").max(30),
  subtotal: z.coerce.number().nonnegative(),
});

const optionalDate = z
  .union([z.coerce.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const optionalPositive = z
  .union([z.coerce.number().positive(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const voucherFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Code must be 3–30 letters, numbers, - or _"),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("Discount must be more than 0"),
  maxDiscount: optionalPositive,
  minSubtotal: z.coerce.number().nonnegative().default(0),
  firstOrderOnly: z.boolean().default(false),
  startsAt: optionalDate,
  expiresAt: optionalDate,
  usageLimit: optionalPositive,
  active: z.boolean().default(true),
  showOnProductPage: z.boolean().default(false),
};

const percentCap = (v) => v.type !== "percent" || v.value === undefined || v.value <= 100;

export const createVoucherSchema = z
  .object(voucherFields)
  .refine(percentCap, { message: "A percentage discount can't be more than 100", path: ["value"] });

export const updateVoucherSchema = z
  .object(voucherFields)
  .partial()
  .refine(percentCap, { message: "A percentage discount can't be more than 100", path: ["value"] });
