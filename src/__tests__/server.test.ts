import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// ── MCP SDK mock ───────────────────────────────────────────────────────────

const { mockSetRequestHandler, MockServer } = vi.hoisted(() => {
  const mockSetRequestHandler = vi.fn();
  class MockServer {
    setRequestHandler = mockSetRequestHandler;
    connect = vi.fn().mockResolvedValue(undefined);
  }
  return { mockSetRequestHandler, MockServer };
});

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: MockServer,
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  ListToolsRequestSchema: { method: "tools/list" },
  CallToolRequestSchema: { method: "tools/call" },
}));

// Import after mocks
import { createServer, registerTool } from "../server/server";
import { toErrorResult, withErrorHandling } from "../server/errors";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extracts the handler registered for a given schema mock */
function getHandler(schemaMethod: string) {
  const call = mockSetRequestHandler.mock.calls.find(
    ([schema]) => (schema as { method: string }).method === schemaMethod,
  );
  if (!call) throw new Error(`No handler registered for ${schemaMethod}`);
  return call[1] as (req: unknown) => unknown;
}

const PingSchema = z.object({
  message: z.string(),
  count: z.number().optional(),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("createServer()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the registrations array between tests by re-importing won't work in
    // vitest module cache — instead we just create a fresh server and verify
    // handlers are registered.
  });

  it("registers ListTools and CallTool handlers", () => {
    createServer();
    const methods = mockSetRequestHandler.mock.calls.map(
      ([schema]) => (schema as { method: string }).method,
    );
    expect(methods).toContain("tools/list");
    expect(methods).toContain("tools/call");
  });
});

describe("registerTool() + ListTools handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes registered tools in the list response", () => {
    registerTool("ping", "A ping tool", PingSchema, async () => ({
      content: [{ type: "text" as const, text: "pong" }],
    }));
    createServer();

    const listHandler = getHandler("tools/list");
    const result = listHandler({}) as { tools: { name: string }[] };
    expect(result.tools.some((t) => t.name === "ping")).toBe(true);
  });

  it("includes description in tool definition", () => {
    registerTool("ping2", "My description", PingSchema, async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    createServer();
    const listHandler = getHandler("tools/list");
    const result = listHandler({}) as { tools: { name: string; description?: string }[] };
    const tool = result.tools.find((t) => t.name === "ping2");
    expect(tool?.description).toBe("My description");
  });

  it("derives required fields from Zod schema", () => {
    registerTool("ping3", "desc", PingSchema, async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    createServer();
    const listHandler = getHandler("tools/list");
    const result = listHandler({}) as {
      tools: { name: string; inputSchema: { required?: string[] } }[];
    };
    const tool = result.tools.find((t) => t.name === "ping3");
    expect(tool?.inputSchema.required).toContain("message");
    expect(tool?.inputSchema.required).not.toContain("count");
  });
});

describe("CallTool handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the handler and returns its result", async () => {
    registerTool("echo", "echo tool", PingSchema, async ({ message }) => ({
      content: [{ type: "text" as const, text: message }],
    }));
    createServer();
    const callHandler = getHandler("tools/call") as (req: {
      params: { name: string; arguments: Record<string, unknown> };
    }) => Promise<{ content: { text: string }[] }>;

    const result = await callHandler({
      params: { name: "echo", arguments: { message: "hello" } },
    });
    expect(result.content[0].text).toBe("hello");
  });

  it("returns isError=true for unknown tool", async () => {
    createServer();
    const callHandler = getHandler("tools/call") as (req: {
      params: { name: string; arguments: Record<string, unknown> };
    }) => Promise<{ isError: boolean; content: { text: string }[] }>;

    const result = await callHandler({
      params: { name: "does_not_exist", arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does_not_exist");
  });

  it("returns isError=true for invalid arguments", async () => {
    registerTool("typed", "desc", z.object({ num: z.number() }), async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    createServer();
    const callHandler = getHandler("tools/call") as (req: {
      params: { name: string; arguments: Record<string, unknown> };
    }) => Promise<{ isError: boolean }>;

    const result = await callHandler({
      params: { name: "typed", arguments: { num: "not-a-number" } },
    });
    expect(result.isError).toBe(true);
  });

  it("catches handler errors and returns isError result", async () => {
    registerTool("boom", "throws", z.object({}), async () => {
      throw new Error("something exploded");
    });
    createServer();
    const callHandler = getHandler("tools/call") as (req: {
      params: { name: string; arguments: Record<string, unknown> };
    }) => Promise<{ isError: boolean; content: { text: string }[] }>;

    const result = await callHandler({ params: { name: "boom", arguments: {} } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("something exploded");
  });
});

// ── errors.ts ──────────────────────────────────────────────────────────────

describe("toErrorResult()", () => {
  it("converts an Error to an isError result", () => {
    const result = toErrorResult(new Error("oops"));
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { text: string }).text).toContain("oops");
  });

  it("converts a string to an isError result", () => {
    const result = toErrorResult("bad thing");
    expect(result.isError).toBe(true);
  });
});

describe("withErrorHandling()", () => {
  it("returns the result on success", async () => {
    const result = await withErrorHandling(async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { text: string }).text).toBe("ok");
  });

  it("catches thrown errors and returns isError result", async () => {
    const result = await withErrorHandling(async () => {
      throw new Error("catch me");
    });
    expect(result.isError).toBe(true);
  });
});
