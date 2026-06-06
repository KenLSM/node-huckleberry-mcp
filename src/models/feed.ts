import { z } from "zod";

// Typed references for the write side (the tools validate their own inputs).
export const NursingInterval = z.object({
  mode: z.literal("breast"),
  start: z.number(),
  offset: z.number(),
  leftDuration: z.number().optional(),
  rightDuration: z.number().optional(),
  lastSide: z.enum(["left", "right"]).optional(),
  notes: z.string().optional(),
  lastUpdated: z.number().optional(),
});

export const BottleInterval = z.object({
  mode: z.literal("bottle"),
  start: z.number(),
  offset: z.number(),
  amount: z.number(),
  bottleType: z.string(),
  units: z.enum(["ml", "oz"]),
  notes: z.string().optional(),
  lastUpdated: z.number().optional(),
});

export const SolidsInterval = z.object({
  mode: z.literal("solids"),
  start: z.number(),
  offset: z.number(),
  notes: z.string().optional(),
  lastUpdated: z.number().optional(),
});

// Read model for feed/{cid}/intervals — lenient so any feed entry parses
// regardless of `mode` or which optional fields are present. `mode` is a free
// string (not a discriminated union) and unknown fields pass through.
export const FeedingInterval = z
  .object({
    mode: z.string(),
    start: z.number(),
    offset: z.number().optional(),
    lastUpdated: z.number().optional(),
    // nursing
    leftDuration: z.number().optional(),
    rightDuration: z.number().optional(),
    lastSide: z.string().optional(),
    // bottle
    amount: z.number().optional(),
    bottleType: z.string().optional(),
    units: z.string().optional(),
    // shared
    notes: z.string().optional(),
  })
  .passthrough();

export type NursingIntervalParsed = z.infer<typeof NursingInterval>;
export type BottleIntervalParsed = z.infer<typeof BottleInterval>;
export type SolidsIntervalParsed = z.infer<typeof SolidsInterval>;
export type FeedingIntervalParsed = z.infer<typeof FeedingInterval>;
