/**
 * mcp/workspace.ts - the DECLARATIVE WORKSPACE tools.
 *
 * Concept: the shared workspace is derived from the resource declarations -
 * one entry per resource kind (label + write capability + records) plus the
 * FULL capability surface, and direct operator writes (no agent turn, no
 * approval). The web console renders the same payload - no per-resource UI
 * or per-resource MCP code exists anywhere.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { text, err } from "./helpers.ts"
import type { WebConsole } from "../../webui/console.ts"
import { WORKSPACE_RESOURCES } from "../../../workspace.ts"
import { MANTIS_CAPABILITIES } from "../../../capabilities.ts"

export const registerWorkspace = (server: McpServer, web: WebConsole): void => {
  server.tool(
    "mantis_workspace",
    "The shared workspace, derived from the resource declarations: one entry " +
      "per resource kind with its label, write capability name/description, and " +
      "current records (id/text/ts). Also carries the FULL product capability " +
      "surface (capabilities[]) - enable/read/update/delete are discoverable here " +
      "without guessing; every entry comes from the same manifest the session " +
      "tools use.",
    async () => {
      const resources = WORKSPACE_RESOURCES.map((resource) => ({
        kind: resource.kind,
        label: resource.label,
        write: { name: resource.write.name, description: resource.write.description },
        records: web.workspace.records(resource.kind).map((entry: { id: string; text: string; ts: number; source: string }) => ({ id: entry.id, text: entry.text, ts: entry.ts, source: entry.source }))
      }))
      const capabilities = MANTIS_CAPABILITIES.map((c) => ({ name: c.name, tier: c.tier, description: c.description }))
      return text(JSON.stringify({ resources, capabilities }))
    }
  )

  server.tool(
    "mantis_workspace_write",
    "Append a record to a declared workspace resource (kind: " +
      WORKSPACE_RESOURCES.map((r) => r.kind).join("|") + "). The operator " +
      "writes directly here (no agent turn, no approval). Returns the stored record.",
    { kind: z.string().min(1), text: z.string().min(1) },
    async ({ kind, text: recordText }) => {
      const declared = WORKSPACE_RESOURCES.find((resource) => resource.kind === kind)
      if (declared === undefined) return err("unknown kind " + kind)
      try {
        const entry = web.workspace.append(declared.kind, recordText)
        return text(JSON.stringify({ id: entry.id, kind: entry.kind, text: entry.text }))
      } catch (error) {
        return err(error instanceof Error ? error.message : String(error))
      }
    }
  )

  server.tool(
    "mantis_workspace_update",
    "Change the text of ONE existing workspace record by id (ids come from mantis_workspace / recall_notes / note_read outputs). Returns the updated record.",
    { id: z.string().min(1), text: z.string().min(1) },
    async ({ id, text: recordText }) => {
      try {
        const entry = web.workspace.update(id, recordText)
        if (entry === undefined) return err("no record with id " + id)
        return text(JSON.stringify({ id: entry.id, kind: entry.kind, text: entry.text }))
      } catch (error) {
        return err(error instanceof Error ? error.message : String(error))
      }
    }
  )

  server.tool(
    "mantis_workspace_delete",
    "Delete ONE existing workspace record by id (ids come from mantis_workspace / recall_notes / note_read outputs). Deleting a missing record is an error.",
    { id: z.string().min(1) },
    async ({ id }) => {
      if (!web.workspace.remove(id)) return err("no record with id " + id)
      return text("deleted " + id)
    }
  )
}
