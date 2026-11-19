import { z } from "zod";
import {
  SKIN_TYPES,
  HAIR_TYPES,
  SHOPPING_FOR,
  BUDGETS,
  SKIN_CONCERNS,
  HAIR_CONCERNS,
  MAX_WEDDING_DAYS_AHEAD,
  todayInNigeria,
} from "../config/beautyProfile.js";

// Every field is optional; null clears it. Lists replace what was there.
const keys = (obj) => Object.keys(obj);
const list = (values) => z.array(z.enum(values)).max(values.length).transform((a) => [...new Set(a)]);

export const beautyProfileSchema = z
  .object({
    skinType: z.enum(SKIN_TYPES).nullable().optional(),
    hairType: z.enum(HAIR_TYPES).nullable().optional(),
    skinConcerns: list(keys(SKIN_CONCERNS)).optional(),
    hairConcerns: list(keys(HAIR_CONCERNS)).optional(),
    shoppingFor: list(SHOPPING_FOR).optional(),
    budget: z.enum(BUDGETS).nullable().optional(),
    // Result label from the skin-tone tools, e.g. "Warm Golden / Caramel".
    undertone: z.string().trim().max(60).nullable().optional(),
    // YYYY-MM-DD, a real date from today (Nigerian time) up to 3 years ahead.
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
      .refine((d) => {
        const t = new Date(`${d}T12:00:00Z`);
        return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
      }, "That date doesn't exist")
      .refine((d) => d >= todayInNigeria(), "The wedding date can't be in the past")
      .refine(
        (d) => (new Date(`${d}T00:00:00Z`) - new Date(`${todayInNigeria()}T00:00:00Z`)) / 86400000 <= MAX_WEDDING_DAYS_AHEAD,
        "Choose a date within the next 3 years",
      )
      .nullable()
      .optional(),
  })
  .strict();
