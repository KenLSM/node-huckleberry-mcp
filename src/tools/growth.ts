import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logGrowth, getLatestGrowth, getGrowthHistory, editGrowth } from "../client/index.js";

// T2.7: Growth Tools (3 tools)

function asResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// log_growth — record a growth measurement
registerTool(
  "log_growth",
  "Log a growth measurement (any of weight, height, head circumference)",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start in epoch seconds (defaults to now)").optional(),
    weight: z.number().optional(),
    height: z.number().optional(),
    head: z.number().optional(),
    units: z.enum(["metric", "imperial"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logGrowth(client, input.child_uid, {
      time: input.start !== undefined ? new Date(input.start * 1000) : undefined,
      weight: input.weight,
      height: input.height,
      head: input.head,
      units: input.units,
      notes: input.notes,
    });
    return asResult({ growth_id: id });
  },
);

// get_latest_growth — most recent measurement
registerTool(
  "get_latest_growth",
  "Get the most recent growth measurement for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
  }),
  async (input) => {
    const client = await getClient();
    return asResult(await getLatestGrowth(client, input.child_uid));
  },
);

// get_growth_history — measurements ordered by most recent
registerTool(
  "get_growth_history",
  "Get growth measurement history for a child, most recent first",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).optional(),
  }),
  async (input) => {
    const client = await getClient();
    return asResult(await getGrowthHistory(client, input.child_uid, { limit: input.limit }));
  },
);

// edit_growth — update fields on an existing growth entry (id from get_growth_history)
registerTool(
  "edit_growth",
  "Edit an existing growth measurement. Get the entry id from get_growth_history or get_latest_growth first.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    entry_id: z.string().min(1, "entry_id is required (from get_growth_history)"),
    start: z.number().min(0).optional(),
    weight: z.number().optional(),
    height: z.number().optional(),
    head: z.number().optional(),
    units: z.enum(["metric", "imperial"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    await editGrowth(client, input.child_uid, input.entry_id, {
      start: input.start,
      weight: input.weight,
      height: input.height,
      head: input.head,
      units: input.units,
      notes: input.notes,
    });
    return asResult({ edited: input.entry_id });
  },
);
