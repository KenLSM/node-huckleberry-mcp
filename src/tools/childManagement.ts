import { z } from "zod";
import { registerTool } from "../server/server.js";
import { getClient } from "../server/auth.js";
import { getUser, getChild } from "../client/index.js";

// T2.3: Child Management Tools (2 tools)

// get_user — retrieve authenticated user's profile and child list
registerTool(
  "get_user",
  "Retrieve the authenticated user's profile including the list of children they manage",
  z.object({}),
  async () => {
    const client = await getClient();
    const user = await getUser(client);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(user, null, 2),
        },
      ],
    };
  },
);

// get_child — retrieve a specific child's profile
registerTool(
  "get_child",
  "Retrieve a specific child's profile by their UID",
  z.object({
    child_uid: z.string().min(1, "child_uid is required"),
  }),
  async (input) => {
    const client = await getClient();
    const child = await getChild(client, input.child_uid);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(child, null, 2),
        },
      ],
    };
  },
);
