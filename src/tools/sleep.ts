import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logSleep, getSleepHistory, editSleep, deleteSleep } from "../client/index.js";

// T2.4: Sleep Tools (2 tools)

// log_sleep — log a completed sleep session
registerTool(
  "log_sleep",
  "Log a completed sleep session with start and end times",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start is required (epoch seconds)"),
    end: z.number().min(0, "end is required (epoch seconds)"),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logSleep(
      client,
      input.child_uid,
      new Date(input.start * 1000),
      new Date(input.end * 1000),
      { notes: input.notes },
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ sleep_id: id }, null, 2),
        },
      ],
    };
  },
);

// get_sleep_history — retrieve sleep history for a child
registerTool(
  "get_sleep_history",
  "Retrieve sleep history for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).default(50),
  }),
  async (input) => {
    const client = await getClient();
    const result = await getSleepHistory(client, input.child_uid, {
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

// edit_sleep — update fields on an existing sleep entry (id from get_sleep_history)
registerTool(
  "edit_sleep",
  "Edit an existing sleep entry. Get the interval_id from get_sleep_history first.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    interval_id: z.string().min(1, "interval_id is required (from get_sleep_history)"),
    start: z.number().min(0).optional(),
    duration: z.number().min(0).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    await editSleep(client, input.child_uid, input.interval_id, {
      start: input.start,
      duration: input.duration,
      notes: input.notes,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ edited: input.interval_id }, null, 2) }],
    };
  },
);

// delete_sleep — permanently remove a sleep entry (id from get_sleep_history)
registerTool(
  "delete_sleep",
  "Permanently delete a sleep entry. Get the interval_id from get_sleep_history first.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    interval_id: z.string().min(1, "interval_id is required (from get_sleep_history)"),
  }),
  async (input) => {
    const client = await getClient();
    await deleteSleep(client, input.child_uid, input.interval_id);
    return {
      content: [{ type: "text", text: JSON.stringify({ deleted: input.interval_id }, null, 2) }],
    };
  },
);
