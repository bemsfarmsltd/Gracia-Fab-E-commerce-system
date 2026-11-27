import { z } from "zod";

export const startStockTakeSchema = z.object({
  name: z.string().trim().min(2, "Give the count a name, e.g. \"End of November\"").max(80),
  category: z.string().trim().max(60).optional(),
});

export const scanSchema = z.object({ code: z.string().trim().min(1, "Scan or type a code").max(60) });

export const setCountSchema = z.object({ counted: z.number().int().min(0, "Can't be below 0").max(100000) });

export const addCountSchema = z.object({ by: z.number().int().min(-1000).max(1000).refine((n) => n !== 0) });

export const completeStockTakeSchema = z.object({ zeroUncounted: z.boolean().optional() });
