import { z } from "zod";
import { TimestampSchema } from "./timestamp.js";

export const GrowthRecord = z.object({
  id: z.string().optional(),
  childUid: z.string().optional(),
  cid: z.string().optional(),
  date: TimestampSchema,
  weight: z.number().optional(),
  weightUnit: z.enum(["metric", "imperial"]).optional(),
  height: z.number().optional(),
  heightUnit: z.enum(["metric", "imperial"]).optional(),
  headCircumference: z.number().optional(),
  headCircumferenceUnit: z.enum(["metric", "imperial"]).optional(),
  unit: z.enum(["metric", "imperial"]).default("metric"),
  note: z.string().optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export type GrowthRecordParsed = z.infer<typeof GrowthRecord>;
