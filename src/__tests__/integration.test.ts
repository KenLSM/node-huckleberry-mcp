import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server/server.js";

// Importing the tool modules registers every tool at module load time.
import "../tools/childManagement.js";
import "../tools/sleep.js";
import "../tools/feeding.js";
import "../tools/diaper.js";
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

    // Verify tools are registered (child management, sleep, feeding, diaper, solids)
    expect(names.length).toBeGreaterThanOrEqual(15);

    // Spot-check one tool per category is present.
    for (const expected of [
      "get_user",
      "get_child",
      "log_sleep",
      "get_sleep_history",
      "log_nursing",
      "log_bottle",
      "log_solids",
      "log_diaper",
      "log_potty",
      "get_diaper_history",
      "log_growth",
      "get_latest_growth",
      "list_curated_foods",
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
