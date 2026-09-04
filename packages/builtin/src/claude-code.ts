/**
 * Barrel: the ClaudeCode driver split by CONCEPT (see ./cc/).
 * schema.ts -> mcp.ts -> session.ts/result.ts -> driver.ts.
 * Importers keep using this path - nothing else changes.
 */
export { ClaudeCode } from "./cc/driver.ts"
export type { ClaudeCodeOptions } from "./cc/options.ts"
