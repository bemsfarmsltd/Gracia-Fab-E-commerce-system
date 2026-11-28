import { z } from "zod";
import { STORE_PAYMENT_METHOD_IDS } from "../config/storeSales.js";

const id = z.string().regex(/^[0-9a-f]{24}$/, "Invalid product");

export const createSaleSchema = z.object({
  items: z.array(z.object({
    productId: id,
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(999),
  })).min(1, "Add at least one product").max(100),
  paymentMethod: z.enum(STORE_PAYMENT_METHOD_IDS, { message: "Choose how the customer paid" }),
  amountTendered: z.number().int().min(0).max(100_000_000).optional(),
  paymentReference: z.string().trim().max(60).optional(),
  discount: z.number().int().min(0).max(100_000_000).optional(),
  discountReason: z.string().trim().max(120).optional(),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number").optional().or(z.literal("")),
  note: z.string().trim().max(200).optional(),
  // A registered customer picked at the till, to earn loyalty points.
  customerId: z.string().regex(/^[0-9a-f]{24}$/, "Invalid customer").optional(),
});

export const voidSaleSchema = z.object({
  reason: z.string().trim().min(3, "Say why the sale is being voided").max(200),
});
