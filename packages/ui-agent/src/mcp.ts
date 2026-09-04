import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import type { RendererRegistry } from "@effect-agent/ui-renderer"
import type { ExtensionManifest } from "@effect-agent/ui-protocol"
type ExtensionSource = { list(): ReadonlyArray<ExtensionManifest> }

const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] })
export const makeUIMcp = (runtime: UIRuntime, definitions?: DefinitionStore, renderers?: RendererRegistry, extensions?: ExtensionSource): McpServer => {
  const server = new McpServer({ name: "ui-runtime", version: "0.1.0" })
  server.registerTool("ui_get_canvas", { description: "Read a resolved UI canvas.", inputSchema: { canvasId: z.string().optional() } }, async ({ canvasId }) => result(canvasId === undefined ? runtime.view() : runtime.viewCanvas(canvasId)))
  server.registerTool("ui_get_runtime_state", { description: "Read active canvas navigation and visual state.", inputSchema: {} }, async () => result({ navigation: runtime.navigation(), theme: runtime.theme(), renderer: runtime.renderer() }))
  server.registerTool("ui_list_canvases", { description: "List all declared canvases.", inputSchema: {} }, async () => result(definitions === undefined ? [] : Object.values(definitions.snapshot().canvases).map((canvas) => ({ canvasId: canvas.canvasId, title: canvas.title, version: canvas.version }))))
  server.registerTool("ui_list_components", { description: "List declared UI components available as building blocks.", inputSchema: {} }, async () => result(definitions?.listComponents() ?? []))
  server.registerTool("ui_list_renderers", { description: "List available UI renderer implementations.", inputSchema: {} }, async () => result(renderers?.list() ?? []))
  server.registerTool("ui_list_extensions", { description: "List enabled UI extensions.", inputSchema: {} }, async () => result(extensions?.list() ?? []))
  server.registerTool("ui_register_component", { description: "Register a declarative component definition; no code is executed.", inputSchema: { type: z.string(), version: z.string(), category: z.enum(["base", "composite", "canvas", "extension"]), acceptsChildren: z.boolean().optional(), acceptsSlots: z.boolean().optional() } }, async ({ type, version, category, acceptsChildren, acceptsSlots }) => {
    if (definitions === undefined) return result({ ok: false, error: "definition store unavailable" })
    definitions.registerComponent({ type, version, category, capabilities: { acceptsChildren, acceptsSlots } }); return result({ ok: true, type, version })
  })
  server.registerTool("ui_create_canvas", { description: "Create a UI canvas.", inputSchema: { canvasId: z.string(), title: z.string() } }, async ({ canvasId, title }) => {
    runtime.apply({ kind: "create-canvas", canvasId, title }); return result({ ok: true, canvasId })
  })
  server.registerTool("ui_insert_node", { description: "Insert a component node into a canvas.", inputSchema: { canvasId: z.string(), nodeId: z.string(), type: z.string(), value: z.unknown().optional() } }, async ({ canvasId, nodeId, type, value }) => {
    runtime.apply({ kind: "insert-node", canvasId, node: { id: nodeId, type, props: value === undefined ? undefined : { value: value as never } } }); return result({ ok: true, nodeId })
  })
  server.registerTool("ui_patch_node", { description: "Patch a node value using the current canvas version.", inputSchema: { canvasId: z.string(), nodeId: z.string(), value: z.unknown() } }, async ({ canvasId, nodeId, value }) => {
    const version = runtime.version(canvasId)
    runtime.apply({ kind: "patch-node", canvasId, nodeId, props: { value: value as never }, expectedVersion: version }); return result({ ok: true, nodeId })
  })
  server.registerTool("ui_bind_data", { description: "Bind a node property to a state path.", inputSchema: { canvasId: z.string(), nodeId: z.string(), key: z.string(), path: z.string() } }, async ({ canvasId, nodeId, key, path }) => {
    const version = runtime.version(canvasId)
    runtime.apply({ kind: "bind-node", canvasId, nodeId, key, binding: { kind: "path", value: path }, expectedVersion: version }); return result({ ok: true, nodeId, key })
  })
  server.registerTool("ui_remove_node", { description: "Remove a leaf node from a canvas.", inputSchema: { canvasId: z.string(), nodeId: z.string() } }, async ({ canvasId, nodeId }) => {
    const version = runtime.version(canvasId)
    runtime.apply({ kind: "remove-node", canvasId, nodeId }); return result({ ok: true, nodeId, version })
  })
  server.registerTool("ui_link_canvas", { description: "Add a navigable child-canvas reference.", inputSchema: { canvasId: z.string(), nodeId: z.string(), targetCanvasId: z.string(), parentId: z.string().optional() } }, async ({ canvasId, nodeId, targetCanvasId, parentId }) => {
    runtime.apply({ kind: "link-canvas", canvasId, nodeId, targetCanvasId, parentId }); return result({ ok: true, nodeId, targetCanvasId })
  })
  server.registerTool("ui_set_theme", { description: "Switch the active UI theme.", inputSchema: { theme: z.string() } }, async ({ theme }) => {
    runtime.apply({ kind: "set-theme", theme }); return result({ ok: true, theme })
  })
  server.registerTool("ui_set_renderer", { description: "Switch the active UI renderer.", inputSchema: { renderer: z.string() } }, async ({ renderer }) => {
    runtime.apply({ kind: "set-renderer", renderer }); return result({ ok: true, renderer })
  })
  server.registerTool("ui_enter_canvas", { description: "Navigate into a canvas with optional parameters.", inputSchema: { canvasId: z.string(), params: z.record(z.string(), z.unknown()).optional() } }, async ({ canvasId, params }) => {
    await runtime.dispatch({ eventId: "mcp-enter", nodeId: "mcp", type: "navigate", actions: [{ action: "navigate_to_canvas", input: { canvasId, ...(params ?? {}) } }] })
    return result({ ok: true, navigation: runtime.navigation() })
  })
  return server
}
