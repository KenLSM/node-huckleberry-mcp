import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import {
  logGrowth,
  getLatestGrowth,
  getGrowthHistory,
} from "../client/index.js";

// T2.7: Growth Tools (3 tools)

// log_growth — log growth measurements
registerTool(
  "log_growth",
  "Log growth measurements (weight, height, head circumference) for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    weight: z.number().optional(),
    height: z.number().optional(),
    head_circumference: z.number().optional(),
    unit: z.enum(["metric", "imperial"]).default("metric"),
    note: z.string().optional(),
    date: z.number().optional(), // Unix timestamp (defaults to now)
  }),
  async (input) => {
    const client = await getClient();
    const id = await logGrowth(client, input.child_uid, {
      weight: input.weight,
      height: input.height,
      headCircumference: input.head_circumference,
      weightUnit: input.unit,
      heightUnit: input.unit,
      headCircumferenceUnit: input.unit,
      note: input.note,
      time: input.date ? new Date(input.date) : undefined,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ growth_id: id }, null, 2),
        },
      ],
    };
  },
);

// get_latest_growth — retrieve the latest growth record
registerTool(
  "get_latest_growth",
  "Retrieve the latest growth measurements for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
  }),
  async (input) => {
    const client = await getClient();
    const result = await getLatestGrowth(client, input.child_uid);
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

// get_growth_history — retrieve growth history for a child
registerTool(
  "get_growth_history",
  "Retrieve growth history for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).default(10),
  }),
  async (input) => {
    const client = await getClient();
    const result = await getGrowthHistory(client, input.child_uid, {
      limit: input.limit,
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
