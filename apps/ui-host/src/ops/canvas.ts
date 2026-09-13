/**
 * The canvas moves: building a canvas out of nodes, and getting between them.
 *
 * None of these carries an HTTP binding. The console writes through one
 * envelope, `POST /api/command`, which carries a `UICommand` rather than a
 * named call - a different thing from a typed operation, and the host's own
 * route. An agent reaches these as tools; the browser reaches the same
 * `runtime.apply` calls through the envelope.
 *
 * A patch and a binding carry the version the caller read, and are refused if the
 * canvas has moved since. Reading the version here and stating it as what the
 * call expects would compare the canvas with itself — the call arrives, reads
 * the version the canvas is at, and names that — so the refusal could never fire
 * and a move computed from a stale read would land on a canvas that has since
 * changed, which is the one thing the check is for.
 */
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
      // the version after the removal: the one before it is a version this canvas
      // no longer has, and a caller that patched with it would be refused
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
