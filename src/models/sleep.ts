import { z } from "zod";

export const SleepInterval = z.object({
  id: z.string().min(1, "Sleep interval ID required"),
  childUid: z.string().min(1, "Child UID required"),
  startTime: z.number(), // Unix timestamp
  endTime: z.number().optional(),
  note: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

export type SleepIntervalParsed = z.infer<typeof SleepInterval>;
