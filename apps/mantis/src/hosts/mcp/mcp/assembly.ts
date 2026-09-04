/**
 * mcp/assembly.ts - ASSEMBLING the mantis MCP server.
 *
 * Concept: one McpServer over the WebConsole seam - each domain registrar
 * (lifecycle / approvals / workspace / ui) adds its tools; the returned
 * server is handed to the stdio transport. Approved semantics are identical
 * to the web console / dingtalk because they share the same MantisHost +
 * ManualGate + config wiring.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerLifecycle } from "./lifecycle.ts"
import { registerApprovals } from "./approvals.ts"
import { registerWorkspace } from "./workspace.ts"
import { registerUi } from "./ui.ts"
import type { WebConsole } from "../../webui/console.ts"

export interface MantisMcpOptions {
  readonly console: WebConsole
  /** server name shown to the MCP client (default "mantis") */
  readonly name?: string
}

export const makeMantisMcp = (options: MantisMcpOptions): McpServer => {
  const server = new McpServer({ name: options.name ?? "mantis", version: "0.1.0" })
  registerLifecycle(server, options.console)
  registerApprovals(server, options.console)
  registerWorkspace(server, options.console)
  registerUi(server, options.console)
  return server
}
