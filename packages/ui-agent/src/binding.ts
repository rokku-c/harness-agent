import { Effect, Schema } from "effect"
import { Op, notationText, type Binding } from "@effect-agent/core"
import type { UIRuntime } from "@effect-agent/ui-runtime"

const canvasInput = Schema.Struct({ canvasId: Schema.String, title: Schema.String })
const nodeInput = Schema.Struct({ canvasId: Schema.String, nodeId: Schema.String, type: Schema.String, value: Schema.optional(Schema.Unknown) })
const patchInput = Schema.Struct({ canvasId: Schema.String, nodeId: Schema.String, value: Schema.Unknown, expectedVersion: Schema.Number })
const bindInput = Schema.Struct({ canvasId: Schema.String, nodeId: Schema.String, key: Schema.String, path: Schema.String, expectedVersion: Schema.Number })

export const uiBinding = (runtime: UIRuntime): Binding => {
  const create = Op.write({
    name: "ui_create_canvas",
    description: notationText("Create a named UI canvas."),
    input: canvasInput,
    output: Schema.Unknown,
    execute: ({ canvasId, title }) => Effect.sync(() => runtime.apply({ kind: "create-canvas", canvasId, title }))
  })
  const insert = Op.write({
    name: "ui_insert_node",
    description: notationText("Insert a component node into a UI canvas."),
    input: nodeInput,
    output: Schema.Unknown,
    execute: ({ canvasId, nodeId, type, value }) => Effect.sync(() => runtime.apply({ kind: "insert-node", canvasId, node: { id: nodeId, type, props: value === undefined ? undefined : { value: value as never } } }))
  })
  const patch = Op.write({
    name: "ui_patch_node",
    description: notationText("Patch a UI node property with optimistic version checking."),
    input: patchInput,
    output: Schema.Unknown,
    execute: ({ canvasId, nodeId, value, expectedVersion }) => Effect.sync(() => runtime.apply({ kind: "patch-node", canvasId, nodeId, props: { value: value as never }, expectedVersion }))
  })
  const bind = Op.write({
    name: "ui_bind_data",
    description: notationText("Bind a UI node property to a state path."),
    input: bindInput,
    output: Schema.Unknown,
    execute: ({ canvasId, nodeId, key, path, expectedVersion }) => Effect.sync(() => runtime.apply({ kind: "bind-node", canvasId, nodeId, key, binding: { kind: "path", value: path }, expectedVersion }))
  })
  const link = Op.write({
    name: "ui_link_canvas",
    description: notationText("Link a child canvas to a canvas node."),
    input: Schema.Struct({ canvasId: Schema.String, nodeId: Schema.String, targetCanvasId: Schema.String }),
    output: Schema.Unknown,
    execute: ({ canvasId, nodeId, targetCanvasId }) => Effect.sync(() => runtime.apply({ kind: "link-canvas", canvasId, nodeId, targetCanvasId }))
  })
  const enter = Op.write({
    name: "ui_enter_canvas",
    description: notationText("Navigate into a canvas."),
    input: Schema.Struct({ canvasId: Schema.String }),
    output: Schema.Unknown,
    execute: ({ canvasId }) => Effect.sync(() => runtime.apply({ kind: "navigate", canvasId }))
  })
  const read = Op.read({
    name: "ui_get_canvas",
    description: notationText("Read the currently resolved UI canvas."),
    input: Schema.Struct({}),
    output: Schema.Unknown,
    execute: () => Effect.sync(() => runtime.view())
  })
  const theme = Op.write({
    name: "ui_set_theme",
    description: notationText("Switch the active renderer theme."),
    input: Schema.Struct({ theme: Schema.String }),
    output: Schema.Unknown,
    execute: ({ theme }) => Effect.sync(() => runtime.apply({ kind: "set-theme", theme }))
  })
  const renderer = Op.write({
    name: "ui_set_renderer",
    description: notationText("Switch the active UI renderer."),
    input: Schema.Struct({ renderer: Schema.String }),
    output: Schema.Unknown,
    execute: ({ renderer }) => Effect.sync(() => runtime.apply({ kind: "set-renderer", renderer }))
  })
  const remove = Op.write({
    name: "ui_remove_node",
    description: notationText("Remove a leaf node from a UI canvas."),
    input: Schema.Struct({ canvasId: Schema.String, nodeId: Schema.String }),
    output: Schema.Unknown,
    execute: ({ canvasId, nodeId }) => Effect.sync(() => runtime.apply({ kind: "remove-node", canvasId, nodeId }))
  })
  return { uri: "ea://ui/runtime", ops: [create, insert, patch, bind, link, enter, remove, read, theme, renderer] }
}
