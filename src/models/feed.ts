import { z } from "zod";

export const NursingInterval = z.object({
  mode: z.literal("breast"),
  start: z.number(),
  offset: z.number(),
  leftDuration: z.number().optional(),
  rightDuration: z.number().optional(),
  lastSide: z.enum(["left", "right"]).optional(),
  lastUpdated: z.number().optional(),
});

export const BottleInterval = z.object({
  mode: z.literal("bottle"),
  start: z.number(),
  offset: z.number(),
  amount: z.number(),
  bottleType: z.string(),
  units: z.enum(["ml", "oz"]),
  lastUpdated: z.number().optional(),
});

export const SolidsInterval = z.object({
  mode: z.literal("solids"),
  start: z.number(),
  offset: z.number(),
  lastUpdated: z.number().optional(),
});

export const FeedingInterval = z.discriminatedUnion("mode", [
  NursingInterval,
  BottleInterval,
  SolidsInterval,
]);

export type NursingIntervalParsed = z.infer<typeof NursingInterval>;
export type BottleIntervalParsed = z.infer<typeof BottleInterval>;
export type SolidsIntervalParsed = z.infer<typeof SolidsInterval>;
export type FeedingIntervalParsed = z.infer<typeof FeedingInterval>;
