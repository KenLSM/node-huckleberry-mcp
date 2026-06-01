import { z } from "zod";

/**
 * Accepts a Firestore Timestamp object ({ seconds, nanoseconds }) OR a plain
 * Date/number/string and coerces to Date. This is needed because the Firebase
 * JS SDK returns Timestamp objects, not plain numbers, from getDoc().data().
 */
export const TimestampSchema = z
  .union([
    z.object({ seconds: z.number(), nanoseconds: z.number() }),
    z.date(),
    z.number(),
    z.string(),
  ])
  .transform((v) => {
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") return new Date(v);
    return new Date(v.seconds * 1000 + v.nanoseconds / 1_000_000);
  });

export type HbTimestamp = z.output<typeof TimestampSchema>;
