// Entry point — re-exports the public API surface.
// The MCP server layer (Phase 2) imports from here.
export { HuckleberryClient } from "./client/index.js";
export type { HuckleberryClientOptions } from "./client/index.js";
export { HuckleberryAuth } from "./auth/index.js";
export type { AuthSession, AuthCredentials } from "./auth/index.js";
