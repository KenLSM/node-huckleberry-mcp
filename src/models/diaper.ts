import { z } from "zod";

// Diaper / potty entry (diaper/{cid}/intervals). Read model — deliberately
// lenient so real data never fails to parse: `mode` is a free string (the write
// tools validate their own enum), `quantity` may be a scalar (0/50/100) OR a
// per-type map like { pee: 50, poo: 100 } for a combined change, `offset` may be
// absent on some entries, and `.passthrough()` keeps any extra fields (e.g. a
// potty `howItHappened`).
export const DiaperInterval = z
  .object({
    mode: z.string(),
    start: z.number(),
    offset: z.number().optional(),
    quantity: z.union([z.number(), z.record(z.number())]).optional(),
    color: z.string().optional(),
    consistency: z.string().optional(),
    isPotty: z.boolean().optional(),
    howItHappened: z.string().optional(),
    lastUpdated: z.number().optional(),
  })
  .passthrough();

export type DiaperIntervalParsed = z.infer<typeof DiaperInterval>;
