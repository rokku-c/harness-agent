import type { ToolEntry } from "@effect-agent/effect-interface"
import { appKey, type AppEntry } from "./catalog.ts"
import { invokeAppTool, listAppTools } from "./tools.ts"
import { operationAddress, type NodeOperation } from "./operations.ts"

export const appOperations = (app: AppEntry): readonly NodeOperation[] => {
  const node = appKey(app.ns, app.appId)
  return listAppTools(app).map((entry: ToolEntry) => {
    const schema = app.registry?.schemaFor(entry.key)
    return {
      node,
      plane: "interface",
      name: entry.tool.name,
      address: operationAddress(node, "interface", entry.tool.name),
      description: schema?.description ?? entry.tool.description ?? "",
      inputSchema: schema?.parameters ?? entry.tool.inputSchema ?? null,
      outputSchema: schema?.output ?? entry.tool.outputSchema,
      privileged: false,
      invoke: (args: unknown) => invokeAppTool(app, entry.tool.name, args),
    }
  })
}
