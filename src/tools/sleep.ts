import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import {
  startSleep,
  pauseSleep,
  resumeSleep,
  cancelSleep,
  completeSleep,
  logSleep,
  getSleepHistory,
} from "../client/index.js";

// T2.4: Sleep Tools (7 tools)

// start_sleep — begin a new sleep session
registerTool(
  "start_sleep",
  "Start a new sleep session for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    type: z.enum(["nap", "night"]).optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await startSleep(client, input.child_uid, { type: input.type });
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

// pause_sleep — pause an active sleep session
registerTool(
  "pause_sleep",
  "Pause an active sleep session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    sleep_id: z.string().min(1, "sleep_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await pauseSleep(client, input.child_uid, input.sleep_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }, null, 2),
        },
      ],
    };
  },
);

// resume_sleep — resume a paused sleep session
registerTool(
  "resume_sleep",
  "Resume a paused sleep session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    sleep_id: z.string().min(1, "sleep_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await resumeSleep(client, input.child_uid, input.sleep_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }, null, 2),
        },
      ],
    };
  },
);

// cancel_sleep — cancel a sleep session
registerTool(
  "cancel_sleep",
  "Cancel a sleep session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    sleep_id: z.string().min(1, "sleep_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await cancelSleep(client, input.child_uid, input.sleep_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }, null, 2),
        },
      ],
    };
  },
);

// complete_sleep — mark a sleep session as completed
registerTool(
  "complete_sleep",
  "Mark a sleep session as completed",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    sleep_id: z.string().min(1, "sleep_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await completeSleep(client, input.child_uid, input.sleep_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }, null, 2),
        },
      ],
    };
  },
);

// log_sleep — log a completed sleep session
registerTool(
  "log_sleep",
  "Log a completed sleep session with start and end times",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start_time: z.number().min(0, "start_time is required (Unix timestamp)"),
    end_time: z.number().min(0, "end_time is required (Unix timestamp)"),
    type: z.enum(["nap", "night"]).optional(),
    note: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logSleep(
      client,
      input.child_uid,
      new Date(input.start_time),
      new Date(input.end_time),
      { type: input.type, notes: input.note },
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
    limit: z.number().min(1).default(10),
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
