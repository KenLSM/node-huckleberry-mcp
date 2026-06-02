import { z } from "zod";

export const PumpInterval = z.object({
  entryMode: z.enum(["total", "leftright"]),
  start: z.number(),
  offset: z.number(),
  leftAmount: z.number(),
  rightAmount: z.number(),
  units: z.enum(["ml", "oz"]),
  duration: z.number().optional(),
  lastUpdated: z.number().optional(),
});

export type PumpIntervalParsed = z.infer<typeof PumpInterval>;
