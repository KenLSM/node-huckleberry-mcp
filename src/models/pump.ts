import { z } from "zod";

// Pump interval (pump/{cid}/intervals). Read model — lenient: `entryMode` and
// `units` are free strings (not enums), amounts/duration/offset are optional,
// and unknown fields pass through. Only `start` is required.
export const PumpInterval = z
  .object({
    entryMode: z.string().optional(),
    start: z.number(),
    offset: z.number().optional(),
    leftAmount: z.number().optional(),
    rightAmount: z.number().optional(),
    units: z.string().optional(),
    duration: z.number().optional(),
    lastUpdated: z.number().optional(),
  })
  .passthrough();

export type PumpIntervalParsed = z.infer<typeof PumpInterval>;
