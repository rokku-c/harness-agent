import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { chatId, text } from "./helpers.ts"
import type { WebConsole } from "../../webui/console.ts"

export const registerApprovals = (server: McpServer, web: WebConsole): void => {
  server.tool(
    "mantis_pending",
    "List protected tool calls waiting for the operator (approve or deny).",
    async () => {
      const pending = web.pendingApprovals()
      return text(pending.length === 0
        ? "(nothing pending)"
        : pending.map((p) => p.callId + " " + p.input.tool + " " + JSON.stringify(p.input.input)).join("\n"))
    }
  )

  server.tool(
    "mantis_approve",
    "Resolve a pending approval as the operator: allow true executes the " +
      "protected call, false denies it (the session sees a recoverable error).",
    { callId: chatId, allow: z.boolean() },
    async ({ callId, allow }) => {
      const result = await web.resolveApproval(callId, allow)
      return text(result.ok ? "resolved" : "error: " + (result.detail ?? "unknown"))
    }
  )
}
