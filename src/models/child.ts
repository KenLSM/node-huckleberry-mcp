import { z } from "zod";

// Child profile (childs/{cid}). This is read-only info we never write, and the
// real document shape isn't fully captured yet, so the schema is intentionally
// permissive: no invented enums (the app stores gender as "M"/"F", not
// "male"/"female"), and unknown fields pass through rather than failing parse.
export const ChildDocument = z
  .object({
    uid: z.string().optional(),
    name: z.string().optional(),
    nickname: z.string().optional(),
    picture: z.string().optional(),
    color: z.string().optional(),
    gender: z.string().optional(),
    birthDate: z.unknown().optional(),
    weightUnit: z.string().optional(),
    heightUnit: z.string().optional(),
  })
  .passthrough();

export type ChildDocumentParsed = z.infer<typeof ChildDocument>;
