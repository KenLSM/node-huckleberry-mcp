import { z } from "zod";

export const ChildDocument = z.object({
  uid: z.string().min(1, "Child UID required"),
  name: z.string().optional(),
  birthDate: z.number().optional(), // Unix timestamp
  gender: z.enum(["male", "female", "other"]).optional(),
  picture: z.string().optional(),
  nickname: z.string().optional(),
  color: z.string().optional(),
});

export type ChildDocumentParsed = z.infer<typeof ChildDocument>;
