import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { UiSurfaces } from "./surfaces.ts"

const canvasId = z.string().min(1)
const nodeId = z.string().min(1)

export const canvasOperations = ({ runtime }: UiSurfaces): readonly Operation[] => [
  operation({
    name: "ui_create_canvas",
    description: "Create a canvas by id under the active document",
    input: z.object({ canvasId, title: z.string() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "create-canvas", canvasId: input.canvasId, title: input.title })
      return { ok: true, canvasId: input.canvasId }
    },
  }),
  operation({
    name: "ui_insert_node",
    description: "Insert a component node into a canvas",
    input: z.object({ canvasId, nodeId, type: z.string().min(1), value: z.unknown().optional() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "insert-node", canvasId: input.canvasId,
        node: { id: input.nodeId, type: input.type, props: input.value === undefined ? undefined : { value: input.value as never } } })
      return { ok: true, nodeId: input.nodeId }
    },
  }),
  operation({
    name: "ui_patch_node",
    description: "Replace a node's value, refused if the canvas moved since it was read",
    input: z.object({ canvasId, nodeId, value: z.unknown(), expectedVersion: z.number().int() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "patch-node", canvasId: input.canvasId, nodeId: input.nodeId,
        props: { value: input.value as never }, expectedVersion: input.expectedVersion })
      return { ok: true, nodeId: input.nodeId }
    },
  }),
  operation({
    name: "ui_bind_data",
    description: "Bind a node property to a state path, so the node renders whatever that path holds",
    input: z.object({ canvasId, nodeId, key: z.string().min(1), path: z.string(), expectedVersion: z.number().int() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "bind-node", canvasId: input.canvasId, nodeId: input.nodeId, key: input.key,
        binding: { kind: "path", value: input.path }, expectedVersion: input.expectedVersion })
      return { ok: true, nodeId: input.nodeId, key: input.key }
    },
  }),
  operation({
    name: "ui_remove_node",
    description: "Remove a leaf node from a canvas",
    input: z.object({ canvasId, nodeId }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "remove-node", canvasId: input.canvasId, nodeId: input.nodeId })
      return { ok: true, nodeId: input.nodeId, version: runtime.version(input.canvasId) }
    },
  }),
  operation({
    name: "ui_link_canvas",
    description: "Add a navigable reference from a node to another canvas",
    input: z.object({ canvasId, nodeId, targetCanvasId: canvasId, parentId: z.string().min(1).optional() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "link-canvas", canvasId: input.canvasId, nodeId: input.nodeId,
        targetCanvasId: input.targetCanvasId, parentId: input.parentId })
      return { ok: true, nodeId: input.nodeId, targetCanvasId: input.targetCanvasId }
    },
  }),
  operation({
    name: "ui_enter_canvas",
    description: "Navigate into a canvas, with the parameters that canvas reads",
    input: z.object({ canvasId, params: z.record(z.string(), z.unknown()).optional() }).strict(),
    handler: async (input) => {
      await runtime.dispatch({ eventId: "mcp-enter", nodeId: "mcp", type: "navigate",
        actions: [{ action: "navigate_to_canvas", input: { canvasId: input.canvasId, ...(input.params ?? {}) } }] })
      return { ok: true, navigation: runtime.navigation() }
    },
  }),
]
