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

// list_custom_foods — retrieve custom solids foods created for a child
registerTool(
  "list_custom_foods",
  "Retrieve custom solids foods created for a child (newest first; archived excluded unless include_archived).",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    include_archived: z.boolean().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const result = await listCustomFoods(client, input.child_uid, {
      includeArchived: input.include_archived,
    });
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

// create_custom_food — create a custom solids food entry
registerTool(
  "create_custom_food",
  "Create a custom solids food for a child. Returns the food id, which can be passed to log_solids as a food with source 'custom'.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    name: z.string().min(1, "Food name is required"),
    image: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await createCustomFood(client, input.child_uid, input.name, {
      image: input.image,
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
