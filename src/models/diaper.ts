import { z } from "zod";
import { TimestampSchema } from "./timestamp.js";

export const DiaperLog = z.object({
  id: z.string().optional(),
  childUid: z.string().optional(),
  cid: z.string().optional(),
  date: TimestampSchema,
  type: z.enum(["pee", "poo", "both", "dry"]).default("both"),
  color: z.string().optional(),
  consistency: z.enum(["hard", "normal", "soft", "runny", "watery", "formed", "mucousy"]).optional(),
  note: z.string().optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export type DiaperLogParsed = z.infer<typeof DiaperLog>;
