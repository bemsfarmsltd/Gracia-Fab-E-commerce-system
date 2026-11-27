import { z } from "zod";

const id = z.string().regex(/^[0-9a-f]{24}$/, "Invalid id");
const naira = z.number().int("Whole naira only").min(0).max(100_000_000);

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier's name").max(100),
  contactName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Enter a valid email").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export const updateSupplierSchema = supplierSchema.partial();

export const purchaseSchema = z.object({
  supplierId: id,
  items: z.array(z.object({
    productId: id,
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(100000),
    unitCost: naira,
  })).min(1, "Add at least one product").max(200),
  invoiceRef: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
  receivedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date").optional(),
});

export const costingSchema = z.object({
  costPrice: naira.nullable().optional(),
  supplierId: id.nullable().optional(),
  reorderLevel: z.number().int().min(0).max(100000).nullable().optional(),
}).refine((b) => Object.keys(b).length > 0, "Nothing to change");
