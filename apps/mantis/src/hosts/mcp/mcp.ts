/**
 * Barrel: the mantis MCP tool surface split by CONCEPT (see ./mcp/).
 * helpers.ts = reply envelope; lifecycle.ts = chat/conversation/events/
 * state; approvals.ts = pending + approve; workspace.ts = declarative
 * workspace reads + operator writes; ui.ts = agent-UI versions; assembly.ts
 * = makeMantisMcp.
 */
export type { MantisMcpOptions } from "./mcp/assembly.ts"
export { makeMantisMcp } from "./mcp/assembly.ts"
