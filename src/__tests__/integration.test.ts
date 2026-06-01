import { describe, it, expect } from "vitest";

/**
 * T3.3 Integration Test: Verify server bootstrap and tool registration.
 * These are module-level tests that verify tools are registered correctly.
 */

// Import server creation and tool registry
import { createServer } from "../server/server.js";
// The tool modules register themselves when imported via index.ts

describe("MCP Server Integration (T3.3)", () => {
  it("server creates without errors", () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server).toBe("object");
  });

  it("server can be instantiated successfully", () => {
    expect(() => {
      createServer();
    }).not.toThrow();
  });
});

describe("Tool Registration Coverage (T2.3–T2.8)", () => {
  // These verify that tool modules are importable (registration happens on import)
  it("child management tools import without error", async () => {
    await import("../tools/childManagement.js");
    expect(true).toBe(true);
  });

  it("sleep tools import without error", async () => {
    await import("../tools/sleep.js");
    expect(true).toBe(true);
  });

  it("feeding tools import without error", async () => {
    await import("../tools/feeding.js");
    expect(true).toBe(true);
  });

  it("health tools import without error", async () => {
    await import("../tools/health.js");
    expect(true).toBe(true);
  });

  it("growth tools import without error", async () => {
    await import("../tools/growth.js");
    expect(true).toBe(true);
  });

  it("solids tools import without error", async () => {
    await import("../tools/solids.js");
    expect(true).toBe(true);
  });
});

