/**
 * One app's interface plane projected into node operations, addressed under the
 * app's own `ns::appId` node. `listAppTools` already applies the authorize()
 * gate, so a plane the caller may not read is absent from the table rather than
 * present and uninvokable.
 *
 * Schemas come from the live registry, not the descriptor: what the app
 * registered is what the table describes, and both drift together on a swap.
 */
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
