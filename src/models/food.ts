import { z } from "zod";

export const CustomFood = z.object({
  id: z.string().min(1, "Food ID required"),
  childUid: z.string().min(1, "Child UID required"),
  name: z.string().min(1, "Food name required"),
  category: z.string().optional(),
  allergens: z.array(z.string()).default([]),
  nutrition: z
    .object({
      calories: z.number().optional(),
      protein: z.number().optional(),
      fat: z.number().optional(),
      carbs: z.number().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type CustomFoodParsed = z.infer<typeof CustomFood>;
