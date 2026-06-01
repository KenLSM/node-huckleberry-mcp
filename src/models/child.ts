import { z } from "zod";
import { TimestampSchema } from "./timestamp.js";

export const ChildDocument = z.object({
  uid: z.string().optional(),
  name: z.string().optional(),
  birthDate: TimestampSchema.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  picture: z.string().optional(),
  nickname: z.string().optional(),
  color: z.string().optional(),
  weightUnit: z.enum(["metric", "imperial"]).optional(),
  heightUnit: z.enum(["metric", "imperial"]).optional(),
});

export type ChildDocumentParsed = z.infer<typeof ChildDocument>;
