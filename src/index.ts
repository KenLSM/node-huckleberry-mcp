#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/index.js";

// Tool categories are registered by importing their modules.
// Each import calls registerTool() at module load time.
// (Populated in T2.3–T2.8; importing here once the modules exist.)

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
