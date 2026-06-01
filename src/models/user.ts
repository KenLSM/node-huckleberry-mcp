import { z } from "zod";

export const ChildListEntry = z.object({
  cid: z.string().min(1, "Child UID required"),
  nickname: z.string().optional(),
  picture: z.string().optional(),
  color: z.string().optional(),
});

export type ChildListEntryParsed = z.infer<typeof ChildListEntry>;

export const FirebaseUserDocument = z.object({
  childList: z.array(ChildListEntry).default([]),
  hbChilds: z.record(z.object({ addedAt: z.number().optional() })).default({}),
  lastChild: z.string().optional(),
  email: z.string().email().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  latestTimezone: z.string().optional(),
  subscription: z.unknown().optional(),
  installedApps: z.unknown().optional(),
});

export type FirebaseUserDocumentParsed = z.infer<typeof FirebaseUserDocument>;
