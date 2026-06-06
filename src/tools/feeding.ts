import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import {
  logNursing,
  logBottle,
  logSolids,
  logPump,
  listPumpIntervals,
  getFeedHistory,
  editFeed,
} from "../client/index.js";

// T2.5: Feeding Tools (7 tools)

// log_nursing — log a nursing session
registerTool(
  "log_nursing",
  "Log a nursing session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start is required (epoch seconds)"),
    left_duration: z.number().optional(),
    right_duration: z.number().optional(),
    last_side: z.enum(["left", "right"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logNursing(client, input.child_uid, {
      start: input.start,
      leftDuration: input.left_duration,
      rightDuration: input.right_duration,
      lastSide: input.last_side,
      notes: input.notes,
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

// log_bottle — log a bottle feeding
registerTool(
  "log_bottle",
  "Log a bottle feeding",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start is required (epoch seconds)"),
    amount: z.number().min(0, "amount is required"),
    bottle_type: z.string().min(1, "bottle_type is required (e.g. Breast Milk, Formula)"),
    units: z.enum(["ml", "oz"]),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logBottle(client, input.child_uid, {
      start: input.start,
      amount: input.amount,
      bottleType: input.bottle_type,
      units: input.units,
      notes: input.notes,
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

// log_solids — log solids feeding
registerTool(
  "log_solids",
  "Log a solids feeding",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start is required (epoch seconds)"),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logSolids(client, input.child_uid, {
      start: input.start,
      notes: input.notes,
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

// log_pump — log a pumping session
registerTool(
  "log_pump",
  "Log a pumping session",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    start: z.number().min(0, "start is required (epoch seconds)"),
    left_amount: z.number().min(0),
    right_amount: z.number().min(0),
    units: z.enum(["ml", "oz"]),
    duration: z.number().optional(),
    total_amount: z.number().optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    const id = await logPump(client, input.child_uid, {
      start: input.start,
      leftAmount: input.left_amount,
      rightAmount: input.right_amount,
      units: input.units,
      duration: input.duration,
      totalAmount: input.total_amount,
      notes: input.notes,
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

// list_pump_intervals — retrieve pump sessions
registerTool(
  "list_pump_intervals",
  "Retrieve pump sessions for a child",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    limit: z.number().min(1).default(50),
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
    limit: z.number().min(1).default(50),
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

// edit_feed — update fields on an existing feed entry (id from get_feed_history)
registerTool(
  "edit_feed",
  "Edit an existing feed entry. Get the interval_id from get_feed_history first.",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
    interval_id: z.string().min(1, "interval_id is required (from get_feed_history)"),
    start: z.number().min(0).optional(),
    amount: z.number().min(0).optional(),
    bottle_type: z.string().optional(),
    units: z.enum(["ml", "oz"]).optional(),
    left_duration: z.number().min(0).optional(),
    right_duration: z.number().min(0).optional(),
    last_side: z.enum(["left", "right"]).optional(),
    notes: z.string().optional(),
  }),
  async (input) => {
    const client = await getClient();
    await editFeed(client, input.child_uid, input.interval_id, {
      start: input.start,
      amount: input.amount,
      bottleType: input.bottle_type,
      units: input.units,
      leftDuration: input.left_duration,
      rightDuration: input.right_duration,
      lastSide: input.last_side,
      notes: input.notes,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ edited: input.interval_id }, null, 2) }],
    };
  },
);
