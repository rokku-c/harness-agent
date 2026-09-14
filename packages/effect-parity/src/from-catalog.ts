import { canAccessAppPlane, listAppTools, type AppEntry } from "@effect-agent/effect-apps"
import { toJsonSchema } from "@effect-agent/effect-interface"
import type { ToolEntry } from "@effect-agent/effect-interface"
import type { ParityAction, ParityAppView } from "./types.ts"

const inputSchemaOf = (tool: ToolEntry["tool"]): unknown => {
  const raw = tool.inputSchema ?? (tool.input !== undefined ? toJsonSchema(tool.input) : undefined)
  return raw ?? { type: "object" }
}

const actionOf = (entry: ToolEntry): ParityAction => {
  const description = entry.tool.description ?? entry.tool.title
  const action: ParityAction = { name: entry.tool.name, inputSchema: inputSchemaOf(entry.tool) }
  return description !== undefined ? { ...action, description } : action
}

export const fromCatalogEntry = (app: AppEntry): ParityAppView => {
  const tools = listAppTools(app)
  const uiOpen = canAccessAppPlane(app, "ui")
  return {
    ns: app.ns,
    appId: app.appId,
    view: uiOpen ? app.ui?.doc?.() : undefined,
    state: uiOpen ? app.ui?.state?.() : undefined,
    actions: tools.map(actionOf),
  }
}
