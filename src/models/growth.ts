import { z } from "zod";

export const GrowthRecord = z.object({
  _stub: z.literal(true),
});

export type GrowthRecordParsed = z.infer<typeof GrowthRecord>;
