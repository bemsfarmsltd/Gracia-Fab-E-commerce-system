import { z } from "zod";

export const addStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
});

export const setPasswordSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, "This link isn't valid"),
  password: z.string().min(8, "Use at least 8 characters").max(100),
});
