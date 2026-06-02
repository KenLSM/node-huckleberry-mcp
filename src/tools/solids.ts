import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { listCuratedFoods, listCustomFoods, createCustomFood } from "../client/index.js";

// T2.8: Solids / Food Tools (3 tools)
// Note: log_solids is in feeding.ts (log_solids is part of the feed collection)

// list_curated_foods — retrieve curated food database
registerTool(
  "list_curated_foods",
  "Retrieve the list of curated foods from the food database",
  z.object({
    limit: z.number().min(1).default(50),
  }),
  async (input) => {
    const result = await listCuratedFoods();
    const limited = result.slice(0, input.limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(limited, null, 2),
        },
      ],
    };
  },
);

// list_custom_foods — retrieve custom foods created for a child
registerTool(
  "list_custom_foods",
  "Retrieve custom foods created for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
  }),
  async (input) => {
    const client = await getClient();
    const result = await listCustomFoods(client, input.child_uid);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// create_custom_food — create a custom food entry
registerTool(
  "create_custom_food",
  "Create a custom food entry for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    name: z.string().min(1, "Food name is required"),
    category: z.string().optional(),
    allergens: z.array(z.string()).optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await createCustomFood(client, input.child_uid, input.name, {
      category: input.category,
      allergens: input.allergens,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ food_id: id }, null, 2),
        },
      ],
    };
  },
);
