#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/index.js";

// Registering prompt templates (side-effect import).
import "./server/prompts.js";

// Tool categories are registered by importing their modules.
// Each import calls registerTool() at module load time.
import "./tools/childManagement.js";
import "./tools/sleep.js";
import "./tools/feeding.js";
import "./tools/diaper.js";
import "./tools/growth.js";
import "./tools/solids.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until stdin closes or the process is killed.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
