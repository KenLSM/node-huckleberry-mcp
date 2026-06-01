import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server/server.js";

// Importing the tool modules registers every tool at module load time.
import "../tools/childManagement.js";
import "../tools/sleep.js";
import "../tools/feeding.js";
import "../tools/health.js";
import "../tools/growth.js";
import "../tools/solids.js";

/**
 * T3.3 integration smoke test: boot the MCP server over an in-memory transport
 * and verify the registered tools are actually listable by a client.
 */

async function connectedClient(): Promise<Client> {
  const server = createServer();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

describe("MCP server integration", () => {
  it("creates a server without throwing", () => {
    expect(() => createServer()).not.toThrow();
  });

  it("lists every registered tool over the transport", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    // The Python original exposes 22 tools; this port adds a few more.
    expect(names.length).toBeGreaterThanOrEqual(22);

    // Spot-check one tool per category is present.
    for (const expected of [
      "get_user",
      "get_child",
      "start_sleep",
      "start_feeding",
      "log_diaper",
      "log_growth",
      "log_solids",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("returns a structured error for an unknown tool", async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: "does_not_exist", arguments: {} });
    expect(result.isError).toBe(true);
  });
});
