import { z } from "zod";

export const FeedingInterval = z.object({
  id: z.string().min(1, "Feeding interval ID required"),
  childUid: z.string().min(1, "Child UID required"),
  startTime: z.number(), // Unix timestamp
  endTime: z.number().optional(),
  type: z
    .enum(["nursing", "bottle", "pump", "mixed"])
    .default("nursing"),
  side: z.enum(["left", "right", "both"]).optional(), // For nursing
  duration: z.number().optional(), // In minutes
  amount: z.number().optional(), // In ml for bottles
  note: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

export type FeedingIntervalParsed = z.infer<typeof FeedingInterval>;
