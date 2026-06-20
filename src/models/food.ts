import { z } from "zod";

// Custom solids food at types/{cid}/custom/{id}. Read model — lenient so real
// docs never fail to parse. The live/Python write shape is `type:"solids"`,
// `source:"custom"`, `archived`, `image`, and ISO-string `created_at`/`updated_at`;
// `childUid` is injected by the read op, not stored. Timestamps are accepted as
// string OR number to tolerate legacy numeric-epoch docs we wrote earlier.
export const CustomFood = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    source: z.string().optional(),
    archived: z.boolean().optional(),
    image: z.string().optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
    updated_at: z.union([z.string(), z.number()]).optional(),
    childUid: z.string().optional(),
  })
  .passthrough();

export type CustomFoodParsed = z.infer<typeof CustomFood>;
