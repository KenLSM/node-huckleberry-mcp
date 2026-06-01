import { z } from "zod";

export const GrowthRecord = z.object({
  id: z.string().min(1, "Growth record ID required"),
  childUid: z.string().min(1, "Child UID required"),
  date: z.number(), // Unix timestamp
  weight: z.number().optional(), // In kg or lbs
  height: z.number().optional(), // In cm or inches
  headCircumference: z.number().optional(), // In cm or inches
  unit: z.enum(["metric", "imperial"]).default("metric"),
  note: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type GrowthRecordParsed = z.infer<typeof GrowthRecord>;
