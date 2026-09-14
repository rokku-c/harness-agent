import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerLifecycle } from "./lifecycle.ts"
import { registerApprovals } from "./approvals.ts"
import { registerWorkspace } from "./workspace.ts"
import type { WebConsole } from "../../webui/console.ts"

export interface MantisMcpOptions {
  readonly console: WebConsole
  readonly name?: string
}

export const makeMantisMcp = (options: MantisMcpOptions): McpServer => {
  const server = new McpServer({ name: options.name ?? "mantis", version: "0.1.0" })
  registerLifecycle(server, options.console)
  registerApprovals(server, options.console)
  registerWorkspace(server, options.console)
  return server
}
