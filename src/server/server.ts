import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { withErrorHandling } from "./errors.js";

export type ToolHandler<TInput> = (input: TInput) => Promise<CallToolResult>;

interface ToolRegistration {
  definition: Tool;
  handler: ToolHandler<unknown>;
  schema: z.ZodTypeAny;
}

const registrations: ToolRegistration[] = [];

/**
 * Registers an MCP tool.
 *
 * @param name    Unique tool name (snake_case, matching the Python originals).
 * @param description Human-readable description shown in the tool list.
 * @param inputSchema Zod object schema — converted to JSON Schema for the tool
 *                    definition and used to parse/validate incoming arguments.
 * @param handler  Async function receiving validated input and returning a
 *                 CallToolResult. Errors are caught centrally and returned as
 *                 isError results.
 */
export function registerTool<TSchema extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  inputSchema: TSchema,
  handler: ToolHandler<z.infer<TSchema>>,
): void {
  const definition: Tool = {
    name,
    description,
    inputSchema: zodToJsonSchema(inputSchema),
  };
  registrations.push({
    definition,
    handler: handler as ToolHandler<unknown>,
    schema: inputSchema,
  });
}

/**
 * Creates and configures the MCP Server instance.
 * Must be called after all tools have been registered via `registerTool`.
 */
export function createServer(): Server {
  const server = new Server(
    { name: "node-huckleberry-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: registrations.map((r) => r.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params;
    const reg = registrations.find((r) => r.definition.name === name);
    if (!reg) {
      return Promise.resolve<CallToolResult>({
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      });
    }
    const parsed = reg.schema.safeParse(args ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return Promise.resolve<CallToolResult>({
        content: [{ type: "text", text: `Invalid arguments: ${msg}` }],
        isError: true,
      });
    }
    return withErrorHandling(() => reg.handler(parsed.data));
  });

  return server;
}

// ── Minimal Zod → JSON Schema converter ───────────────────────────────────
// Handles the subset of Zod types actually used in tool input schemas.

function zodToJsonSchema(schema: z.ZodTypeAny): Tool["inputSchema"] {
  return { type: "object", ...zodShapeToJsonSchema(schema) } as Tool["inputSchema"];
}

function zodShapeToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value);
      if (!isOptional(value)) required.push(key);
    }
    return { properties, ...(required.length > 0 && { required }) };
  }
  return {};
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap optional/default wrappers
  const inner = unwrap(field);
  if (inner instanceof z.ZodString) return { type: "string" };
  if (inner instanceof z.ZodNumber) return { type: "number" };
  if (inner instanceof z.ZodBoolean) return { type: "boolean" };
  if (inner instanceof z.ZodEnum) return { type: "string", enum: inner.options };
  if (inner instanceof z.ZodArray) return { type: "array", items: zodFieldToJsonSchema(inner.element) };
  if (inner instanceof z.ZodObject) return { type: "object", ...zodShapeToJsonSchema(inner) };
  return {};
}

function unwrap(field: z.ZodTypeAny): z.ZodTypeAny {
  if (field instanceof z.ZodOptional) return unwrap(field.unwrap());
  if (field instanceof z.ZodDefault) return unwrap(field.removeDefault());
  if (field instanceof z.ZodNullable) return unwrap(field.unwrap());
  return field;
}

function isOptional(field: z.ZodTypeAny): boolean {
  return field instanceof z.ZodOptional || field instanceof z.ZodDefault;
}
