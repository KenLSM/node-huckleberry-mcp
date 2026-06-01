import { z } from "zod";
import { TimestampSchema } from "./timestamp.js";

export const SleepTypeSchema = z.enum(["nap", "night"]);
export type SleepType = z.infer<typeof SleepTypeSchema>;

export const SleepInterval = z.object({
  id: z.string().optional(),
  childUid: z.string().optional(),
  cid: z.string().optional(),
  startTime: TimestampSchema,
  endTime: TimestampSchema.optional(),
  pauseTime: TimestampSchema.optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).default("active"),
  type: SleepTypeSchema.optional(),
  note: z.string().optional(),
  notes: z.string().optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export type SleepIntervalParsed = z.infer<typeof SleepInterval>;
