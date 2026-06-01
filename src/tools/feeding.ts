import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import {
  startNursing,
  pauseNursing,
  resumeNursing,
  switchNursingSide,
  completeNursing,
  logBottle,
  logPump,
  listPumpIntervals,
  getFeedHistory,
} from "../client/index.js";

// T2.5: Feeding Tools (8 tools)

// start_feeding — begin a new feeding session
registerTool(
  "start_feeding",
  "Start a new nursing session for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    side: z.enum(["left", "right", "both"]).optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await startNursing(client, input.child_uid, {
      side: input.side,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ feed_id: id }, null, 2),
        },
      ],
    };
  },
);

// pause_feeding — pause an active feeding session
registerTool(
  "pause_feeding",
  "Pause an active nursing session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    feed_id: z.string().min(1, "feed_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await pauseNursing(client, input.child_uid, input.feed_id);
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

// resume_feeding — resume a paused feeding session
registerTool(
  "resume_feeding",
  "Resume a paused nursing session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    feed_id: z.string().min(1, "feed_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await resumeNursing(client, input.child_uid, input.feed_id);
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

// switch_feeding_side — switch nursing side during a session
registerTool(
  "switch_feeding_side",
  "Switch nursing side during an active nursing session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    feed_id: z.string().min(1, "feed_id is required"),
    side: z.enum(["left", "right"]),
  }),
  async (input) => {
    const client = await getClient();
    await switchNursingSide(client, input.child_uid, input.feed_id, input.side);
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

// complete_feeding — mark a feeding session as completed
registerTool(
  "complete_feeding",
  "Mark a nursing session as completed",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    feed_id: z.string().min(1, "feed_id is required"),
  }),
  async (input) => {
    const client = await getClient();
    await completeNursing(client, input.child_uid, input.feed_id);
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

// log_bottle — log a bottle feeding
registerTool(
  "log_bottle",
  "Log a bottle feeding session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start_time: z.number().min(0, "start_time is required (Unix timestamp)"),
    end_time: z.number().min(0, "end_time is required (Unix timestamp)"),
    amount: z.number().min(0, "amount in ml is required"),
    note: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logBottle(
      client,
      input.child_uid,
      new Date(input.start_time),
      new Date(input.end_time),
      input.amount,
      { notes: input.note },
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ feed_id: id }, null, 2),
        },
      ],
    };
  },
);

// log_pump — log a pumped milk feeding
registerTool(
  "log_pump",
  "Log a pumped milk feeding session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start_time: z.number().min(0, "start_time is required (Unix timestamp)"),
    end_time: z.number().min(0, "end_time is required (Unix timestamp)"),
    amount: z.number().min(0, "amount in ml is required"),
    note: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logPump(
      client,
      input.child_uid,
      new Date(input.start_time),
      new Date(input.end_time),
      input.amount,
      { notes: input.note },
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ feed_id: id }, null, 2),
        },
      ],
    };
  },
);

// list_pump_intervals — retrieve pump sessions
registerTool(
  "list_pump_intervals",
  "Retrieve pump sessions for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).default(10),
  }),
  async (input) => {
    const client = await getClient();
    const result = await listPumpIntervals(client, input.child_uid, {
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

// get_feed_history — retrieve feeding history
registerTool(
  "get_feed_history",
  "Retrieve feeding history for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).default(10),
  }),
  async (input) => {
    const client = await getClient();
    const result = await getFeedHistory(client, input.child_uid, {
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
