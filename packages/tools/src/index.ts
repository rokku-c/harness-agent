/**
 * @effect-agent/tools — L1 tool transport layer
 *
 * API-as-data tool registry (ToolDescriptor → any implementation
 * surface) + MCP session adapter skeleton (stdio/http transports belong
 * to implementation packages). assembly uses the registry to provide
 * Bindings to the Agent; hidden = capability trimming.
 */
export * from "./descriptor.ts"
export * from "./registry.ts"
export * from "./mcp.ts"
