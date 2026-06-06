import { z } from "zod";

// Sleep interval (sleep/{cid}/intervals). Read model — lenient so real entries
// never fail to parse: only `start` is required; everything else is optional and
// unknown fields pass through.
export const SleepInterval = z
  .object({
    start: z.number(),
    duration: z.number().optional(),
    offset: z.number().optional(),
    lastUpdated: z.number().optional(),
    notes: z.string().optional(),
    _id: z.string().optional(),
  })
  .passthrough();

export type SleepIntervalParsed = z.infer<typeof SleepInterval>;
