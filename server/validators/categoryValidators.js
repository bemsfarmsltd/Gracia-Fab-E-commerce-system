import { z } from "zod";

const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const name = z.string().trim().min(1, "Give it a name").max(60, "Keep the name under 60 characters");

export const createCategorySchema = z.object({
  name,
  parent: z.string().trim().min(1).max(60).nullable().optional(),
});

export const updateCategorySchema = z
  .object({ name: name.optional(), active: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.active !== undefined, { message: "Nothing to change" });

export const reorderCategoriesSchema = z.object({ ids: z.array(id).min(1).max(200) });

export const assignCategorySchema = z.object({
  productIds: z.array(id).min(1, "Tick at least one product").max(1000),
  subcategory: z.string().trim().min(1, "Choose a category"),
});
