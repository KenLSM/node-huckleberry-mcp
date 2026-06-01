import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Converts any thrown value into an MCP CallToolResult with isError=true.
 * Tool handlers call this to return structured error responses rather than
 * letting the server propagate an unhandled exception.
 */
export function toErrorResult(err: unknown): CallToolResult {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Wraps a tool handler so any thrown error is caught and returned as an
 * isError result instead of crashing the server.
 */
export function withErrorHandling(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return fn().catch(toErrorResult);
}
