import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logDiaper, logPotty } from "../client/index.js";

// T2.6: Health/Diaper Tools (2 tools)

// log_diaper — log a diaper change
registerTool(
  "log_diaper",
  "Log a diaper change for a child (pee, poo, both, or dry)",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    type: z.enum(["pee", "poo", "both", "dry"]),
    color: z
      .enum([
        "yellow",
        "brown",
        "green",
        "black",
        "red",
        "white",
        "orange",
        "other",
      ])
      .optional(),
    consistency: z
      .enum(["hard", "normal", "soft", "runny", "watery", "formed", "mucousy"])
      .optional(),
    note: z.string().optional(),
    date: z.number().optional(), // Unix timestamp (defaults to now)
  }),
  async (input) => {
    const client = await getClient();
    const id = await logDiaper(client, input.child_uid, input.type, {
      color: input.color,
      consistency: input.consistency,
      note: input.note,
      time: input.date ? new Date(input.date) : undefined,
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
    type: z.enum(["pee", "poo"]),
    note: z.string().optional(),
    date: z.number().optional(), // Unix timestamp (defaults to now)
  }),
  async (input) => {
    const client = await getClient();
    const id = await logPotty(client, input.child_uid, input.type, {
      note: input.note,
      time: input.date ? new Date(input.date) : undefined,
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
