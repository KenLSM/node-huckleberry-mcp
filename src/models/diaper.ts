import { z } from "zod";

export const DiaperLog = z.object({
  id: z.string().min(1, "Diaper log ID required"),
  childUid: z.string().min(1, "Child UID required"),
  date: z.number(), // Unix timestamp
  type: z.enum(["pee", "poo", "both", "dry"]).default("both"),
  color: z.string().optional(), // E.g., "yellow", "brown", "green"
  consistency: z.enum(["hard", "normal", "soft", "runny"]).optional(),
  note: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type DiaperLogParsed = z.infer<typeof DiaperLog>;
