import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logDiaper, logPotty, getDiaperHistory, editDiaper } from "../client/index.js";

// T2.6: Diaper & Potty Tools (3 tools)

// log_diaper — log a diaper change
registerTool(
  "log_diaper",
  "Log a diaper change for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    mode: z.enum(["pee", "poo", "both", "dry"]),
    start: z.number().min(0, "start is required (epoch seconds)"),
    color: z.string().optional(),
    consistency: z.string().optional(),
    pee_amount: z.enum(["little", "medium", "big"]).optional(),
    poo_amount: z.enum(["little", "medium", "big"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logDiaper(client, input.child_uid, {
      mode: input.mode,
      start: input.start,
      color: input.color,
      consistency: input.consistency,
      peeAmount: input.pee_amount,
      pooAmount: input.poo_amount,
      notes: input.notes,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ diaper_id: id }, null, 2),
        },
      ],
    };
  },
);

// log_potty — log potty training activity
registerTool(
  "log_potty",
  "Log potty training activity for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    mode: z.enum(["pee", "poo"]),
    start: z.number().min(0, "start is required (epoch seconds)"),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logPotty(client, input.child_uid, {
      mode: input.mode,
      start: input.start,
      notes: input.notes,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ potty_id: id }, null, 2),
        },
      ],
    };
  },
);

// get_diaper_history — diaper/potty events, most recent first
registerTool(
  "get_diaper_history",
  "Get diaper and potty history for a child, most recent first",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).optional(),
  }),
  async (input) => {
    const client = await getClient();
    const items = await getDiaperHistory(client, input.child_uid, { limit: input.limit });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(items, null, 2),
        },
      ],
    };
  },
);

// edit_diaper — update fields on an existing diaper/potty entry (id from get_diaper_history)
registerTool(
  "edit_diaper",
  "Edit an existing diaper or potty entry. Get the interval_id from get_diaper_history first.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    interval_id: z.string().min(1, "interval_id is required (from get_diaper_history)"),
    start: z.number().min(0).optional(),
    mode: z.enum(["pee", "poo", "both", "dry"]).optional(),
    color: z.string().optional(),
    consistency: z.string().optional(),
    pee_amount: z.enum(["little", "medium", "big"]).optional(),
    poo_amount: z.enum(["little", "medium", "big"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    await editDiaper(client, input.child_uid, input.interval_id, {
      start: input.start,
      mode: input.mode,
      color: input.color,
      consistency: input.consistency,
      peeAmount: input.pee_amount,
      pooAmount: input.poo_amount,
      notes: input.notes,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ edited: input.interval_id }, null, 2) }],
    };
  },
);
