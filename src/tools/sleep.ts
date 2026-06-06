import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { logSleep, getSleepHistory } from "../client/index.js";

// T2.4: Sleep Tools (2 tools)

// log_sleep — log a completed sleep session
registerTool(
  "log_sleep",
  "Log a completed sleep session with start and end times",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start_time: z.number().min(0, "start_time is required (Unix timestamp in milliseconds)"),
    end_time: z.number().min(0, "end_time is required (Unix timestamp in milliseconds)"),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logSleep(
      client,
      input.child_uid,
      new Date(input.start_time),
      new Date(input.end_time),
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
