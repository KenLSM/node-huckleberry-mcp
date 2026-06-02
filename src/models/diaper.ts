import { z } from "zod";

export const DiaperInterval = z.object({
  mode: z.enum(["pee", "poo", "both", "dry"]),
  start: z.number(),
  offset: z.number(),
  quantity: z.number().optional(),
  color: z.string().optional(),
  consistency: z.string().optional(),
  isPotty: z.boolean().optional(),
  lastUpdated: z.number().optional(),
});

export type DiaperIntervalParsed = z.infer<typeof DiaperInterval>;
