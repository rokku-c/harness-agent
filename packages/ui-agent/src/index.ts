/**
 * The canvas ops an agent drives: building a canvas, patching and binding a
 * node, and moving between canvases.
 *
 * A patch and a binding take the version the caller read, because the refusal
 * they are for is against a canvas that moved since that read. Reading the
 * version here and passing it along states the canvas's own version as the one
 * expected — a comparison that cannot fail, so the guard was never armed and a
 * move computed from a stale read landed anyway.
 */
import type { BindingExpression, Json, UINode } from "@effect-agent/ui-protocol"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { DefinitionStore } from "@effect-agent/ui-definition"
export { uiBinding } from "./binding.ts"

export interface UIAgentOps {
  createCanvas(canvasId: string, title: string): void
  insertNode(canvasId: string, node: UINode, parentId?: string): void
  patchNode(canvasId: string, nodeId: string, props: Record<string, Json>, expectedVersion: number): void
  bindNode(canvasId: string, nodeId: string, key: string, binding: BindingExpression, expectedVersion: number): void
  enterCanvas(canvasId: string): Promise<void>
  listComponents(): ReadonlyArray<import("@effect-agent/ui-protocol").ComponentDefinition>
  linkCanvas(canvasId: string, nodeId: string, targetCanvasId: string, parentId?: string): void
  setTheme(theme: string): void
  setRenderer(renderer: string): void
  setData(path: string, value: Json): void
}

export const makeUIAgentOps = (runtime: UIRuntime, definitions?: DefinitionStore): UIAgentOps => ({
  createCanvas: (canvasId, title) => runtime.apply({ kind: "create-canvas", canvasId, title }),
  insertNode: (canvasId, node, parentId) => runtime.apply({ kind: "insert-node", canvasId, node, parentId }),
  patchNode: (canvasId, nodeId, props, expectedVersion) =>
    runtime.apply({ kind: "patch-node", canvasId, nodeId, props, expectedVersion }),
  bindNode: (canvasId, nodeId, key, binding, expectedVersion) =>
    runtime.apply({ kind: "bind-node", canvasId, nodeId, key, binding, expectedVersion }),
  enterCanvas: (canvasId) => Promise.resolve(runtime.apply({ kind: "navigate", canvasId })),
  listComponents: () => definitions?.listComponents() ?? [],
  linkCanvas: (canvasId, nodeId, targetCanvasId, parentId) => runtime.apply({ kind: "link-canvas", canvasId, nodeId, targetCanvasId, parentId }),
  setTheme: (theme) => runtime.apply({ kind: "set-theme", theme }),
  setRenderer: (renderer) => runtime.apply({ kind: "set-renderer", renderer }),
  setData: (path, value) => runtime.apply({ kind: "set-data", path, value })
})
