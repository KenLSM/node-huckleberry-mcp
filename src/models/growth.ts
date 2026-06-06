import { z } from "zod";

// Growth entry stored at health/{cid}/data. `mode` stays the literal "growth" so
// callers can filter the health/data subcollection (which may hold other entry
// types) down to growth records. Unit fields are free strings (not enums) and
// unknown fields pass through, so real entries never fail to parse.
export const GrowthEntry = z
  .object({
    mode: z.literal("growth"),
    start: z.number(),
    offset: z.number().optional(),
    lastUpdated: z.number().optional(),
    weight: z.number().optional(),
    weightUnits: z.string().optional(),
    height: z.number().optional(),
    heightUnits: z.string().optional(),
    head: z.number().optional(),
    headUnits: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type GrowthEntryParsed = z.infer<typeof GrowthEntry>;
