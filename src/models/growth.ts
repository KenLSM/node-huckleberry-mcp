import { z } from "zod";

// Growth entry stored at health/{cid}/data (live-confirmed shape). Unlike other
// trackers, growth does NOT update the parent prefs summary, and has no
// type/id/isNight fields. Units: metric kg/cm/hcm, imperial lbs.oz/ft.in/hin.
export const GrowthEntry = z.object({
  mode: z.literal("growth"),
  start: z.number(),
  offset: z.number(),
  lastUpdated: z.number().optional(),
  weight: z.number().optional(),
  weightUnits: z.enum(["kg", "lbs.oz"]).optional(),
  height: z.number().optional(),
  heightUnits: z.enum(["cm", "ft.in"]).optional(),
  head: z.number().optional(),
  headUnits: z.enum(["hcm", "hin"]).optional(),
});

export type GrowthEntryParsed = z.infer<typeof GrowthEntry>;
