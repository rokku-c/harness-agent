import { invoke, type ToolEntry } from "@effect-agent/effect-interface"
import type { AppEntry } from "./catalog.ts"
import { canAccessAppPlane, requireAppPlane } from "./access.ts"
import { validateAppArguments } from "./validation.ts"

/** Namespaced tools take precedence; legacy tools may only come from this appId. */
const scopedTools = (app: AppEntry): readonly ToolEntry[] => {
  if (app.ns.includes("::") || app.appId.includes("::")) return []
  const tools = app.registry?.tools() ?? []
  const selected = new Map<string, ToolEntry>()
  for (const id of [`${app.ns}::${app.appId}`, app.appId]) {
    for (const entry of tools) {
      if (entry.interfaceId === id && !selected.has(entry.tool.name)) {
        selected.set(entry.tool.name, entry)
      }
    }
  }
  return [...selected.values()]
}

export const listAppTools = (app: AppEntry): readonly ToolEntry[] =>
  canAccessAppPlane(app, "interface") ? scopedTools(app) : []

/** Resolve only this app's exact interfaceId + tool name, never a global name. */
export const resolveAppTool = (app: AppEntry, name: string): ToolEntry => {
  requireAppPlane(app, "interface")
  const id = `${app.ns}::${app.appId}`
  if (app.registry === undefined) throw new Error(`effect-apps: no interface plane for ${id}`)
  const entry = scopedTools(app).find((entry) => entry.tool.name === name)
  if (entry === undefined) throw new Error(`effect-apps: no tool ${id}.${name}`)
  return entry
}

/** Shared action boundary for MCP and mirror: authorize, resolve, validate, invoke. */
export const invokeAppTool = async (app: AppEntry, name: string, args: unknown): Promise<unknown> => {
  const { tool } = resolveAppTool(app, name)
  validateAppArguments(tool, args)
  return invoke(tool, args)
}
