import { z } from "zod";
import { CUSTOMER_SORTS } from "../services/customers.js";

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(CUSTOMER_SORTS).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const customerNoteSchema = z.object({
  text: z.string().trim().min(1, "Write a note first").max(1000, "Keep notes under 1,000 characters"),
});
