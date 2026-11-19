import { z } from "zod";
import {
  SKIN_TYPES,
  HAIR_TYPES,
  SHOPPING_FOR,
  BUDGETS,
  SKIN_CONCERNS,
  HAIR_CONCERNS,
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
  })
  .strict();
