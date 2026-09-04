/**
 * mcp/ui.ts - the AGENT-UI tools.
 *
 * Concept: agent-rendered A2UI surfaces live on the console as an ordered,
 * versioned list. These tools let an MCP client read the latest surface,
 * list every version, and roll back - a restore records a new version so
 * the history stays a strict append log.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { text } from "./helpers.ts"
import type { WebConsole } from "../../webui/console.ts"

export const registerUi = (server: McpServer, web: WebConsole): void => {
  server.tool(
    "mantis_ui_latest",
    "The current agent-rendered UI surface (empty when none was rendered).",
    async () => {
      const latest = web.ui.latest()
      return text(latest === undefined ? "(empty)" : JSON.stringify(latest))
    }
  )

  server.tool(
    "mantis_ui_versions",
    "Every versioned agent-UI render (newest first).",
    async () => {
      const versions = web.ui.versions()
      return text(versions.length === 0 ? "(none)" : versions.map((v) => JSON.stringify(v)).join("\n"))
    }
  )

  server.tool(
    "mantis_ui_restore",
    "Roll the agent UI back to a previous version (recorded as a new version).",
    { version: z.number() },
    async ({ version }) => {
      const result = web.restoreUi(version)
      return text(result.ok ? "restored" : "error: " + (result.detail ?? "?"))
    }
  )
}
