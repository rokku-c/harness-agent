import type { BindingExpression, Json, UINode } from "@effect-agent/ui-protocol"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { DefinitionStore } from "@effect-agent/ui-definition"
export { uiBinding } from "./binding.ts"
export { makeUIMcp } from "./mcp.ts"

export interface UIAgentOps {
  createCanvas(canvasId: string, title: string): void
  insertNode(canvasId: string, node: UINode, parentId?: string): void
  patchNode(canvasId: string, nodeId: string, props: Record<string, Json>): void
  bindNode(canvasId: string, nodeId: string, key: string, binding: BindingExpression): void
  enterCanvas(canvasId: string): Promise<void>
  listComponents(): ReadonlyArray<import("@effect-agent/ui-protocol").ComponentDefinition>
  linkCanvas(canvasId: string, nodeId: string, targetCanvasId: string, parentId?: string): void
  setTheme(theme: string): void
  setRenderer(renderer: string): void
}

export const makeUIAgentOps = (runtime: UIRuntime, definitions?: DefinitionStore): UIAgentOps => ({
  createCanvas: (canvasId, title) => runtime.apply({ kind: "create-canvas", canvasId, title }),
  insertNode: (canvasId, node, parentId) => runtime.apply({ kind: "insert-node", canvasId, node, parentId }),
  patchNode: (canvasId, nodeId, props) => {
    const version = runtime.version(canvasId)
    runtime.apply({ kind: "patch-node", canvasId, nodeId, props, expectedVersion: version })
  },
  bindNode: (canvasId, nodeId, key, binding) => {
    const version = runtime.version(canvasId)
    runtime.apply({ kind: "bind-node", canvasId, nodeId, key, binding, expectedVersion: version })
  },
  enterCanvas: (canvasId) => runtime.dispatch({ eventId: "agent-enter", nodeId: "agent", type: "navigate", actions: [{ action: "navigate_to_canvas", input: { canvasId } }] }),
  listComponents: () => definitions?.listComponents() ?? [],
  linkCanvas: (canvasId, nodeId, targetCanvasId, parentId) => runtime.apply({ kind: "link-canvas", canvasId, nodeId, targetCanvasId, parentId }),
  setTheme: (theme) => runtime.apply({ kind: "set-theme", theme }),
  setRenderer: (renderer) => runtime.apply({ kind: "set-renderer", renderer })
})
