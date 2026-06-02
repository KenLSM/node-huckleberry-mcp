import { z } from "zod";

export const SleepInterval = z.object({
  start: z.number(),
  duration: z.number(),
  offset: z.number(),
  lastUpdated: z.number().optional(),
  _id: z.string().optional(),
});

export type SleepIntervalParsed = z.infer<typeof SleepInterval>;
