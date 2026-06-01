import { z } from "zod";
import { TimestampSchema } from "./timestamp.js";

export const FeedingInterval = z.object({
  id: z.string().optional(),
  childUid: z.string().optional(),
  cid: z.string().optional(),
  startTime: TimestampSchema,
  endTime: TimestampSchema.optional(),
  pauseTime: TimestampSchema.optional(),
  type: z.enum(["nursing", "bottle", "pump", "mixed"]).default("nursing"),
  side: z.enum(["left", "right", "both"]).optional(),
  duration: z.number().optional(),
  amount: z.number().optional(),
  amountUnit: z.enum(["ml", "oz"]).optional(),
  note: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).default("active"),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export type FeedingIntervalParsed = z.infer<typeof FeedingInterval>;
