import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logDiaper, logPotty } from "../client/index.js";

// T2.6: Diaper & Potty Tools (2 tools)

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
  }),
  async (input) => {
    const client = await getClient();
    const id = await logPotty(client, input.child_uid, {
      mode: input.mode,
      start: input.start,
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
