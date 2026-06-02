import { z } from "zod";

// Child profile (childs/{cid}), typed from a live document. Read-only info we
// never write. `.passthrough()` keeps any fields not modelled here rather than
// failing the parse. Note the real field names: `childsName` (not `name`),
// `birthdate` as a "YYYY-MM-DD" string (not a Timestamp), gender as a free-form
// string ("M"/"F"). Display nickname/picture/color live on the user's
// childList entry, not here.
export const ChildDocument = z
  .object({
    childsName: z.string().optional(),
    gender: z.string().optional(),
    birthdate: z.string().optional(),
    naps: z.string().optional(),
    nightStart: z.number().optional(),
    morningCutoff: z.number().optional(),
    pre: z.number().optional(),
    createdAt: z.number().optional(),
    sweetspot: z
      .object({
        daysUsed: z.number().optional(),
        lastUseDay: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ChildDocumentParsed = z.infer<typeof ChildDocument>;
