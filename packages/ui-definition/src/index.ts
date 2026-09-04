import { UIError, type CanvasDefinition, type ComponentDefinition, type UINode, type UICommand } from "@effect-agent/ui-protocol"
export { builtinComponents, registerBuiltins } from "./builtins.ts"

export interface DefinitionSnapshot { readonly canvases: Readonly<Record<string, CanvasDefinition>>; readonly components: ReadonlyArray<ComponentDefinition> }
export interface DefinitionStore { apply(command: UICommand): CanvasDefinition | undefined; getCanvas(id: string): CanvasDefinition | undefined; registerComponent(definition: ComponentDefinition): void; unregisterComponent(type: string): void; getComponent(type: string): ComponentDefinition | undefined; listComponents(): ReadonlyArray<ComponentDefinition>; snapshot(): DefinitionSnapshot }

const withNode = (canvas: CanvasDefinition, node: UINode, parentId?: string, definition?: ComponentDefinition): CanvasDefinition => {
  if (canvas.nodes[node.id] !== undefined) throw new UIError("invalid-tree", "duplicate node: " + node.id)
  if (parentId !== undefined && canvas.nodes[parentId] === undefined) throw new UIError("not-found", "parent node not found: " + parentId)
  if (definition?.capabilities?.acceptsChildren === false && (node.children?.length ?? 0) > 0) throw new UIError("invalid-tree", node.type + " cannot contain children")
  if (definition?.capabilities?.acceptsSlots === false && node.slots !== undefined) throw new UIError("invalid-tree", node.type + " cannot accept slots")
  if (definition?.capabilities?.requiresParent === true && parentId === undefined) throw new UIError("invalid-tree", node.type + " must be nested")
  if (definition !== undefined && node.version !== undefined && node.version !== definition.version) throw new UIError("version-conflict", node.type + " version is stale")
  for (const key of definition?.capabilities?.requiredProps ?? []) if (node.props?.[key] === undefined) throw new UIError("invalid-tree", node.type + " needs " + key)
  const parent = parentId === undefined ? canvas.rootNodeIds : canvas.nodes[parentId]!.children ?? []
  const nextParent = [...parent, node.id]
  const nodes = { ...canvas.nodes, [node.id]: node }
  if (parentId === undefined) return { ...canvas, nodes, rootNodeIds: nextParent, version: canvas.version + 1 }
  nodes[parentId] = { ...nodes[parentId]!, children: nextParent }
  return { ...canvas, nodes, version: canvas.version + 1 }
}

export const makeDefinitionStore = (initial: DefinitionSnapshot = { canvases: {}, components: [] }): DefinitionStore => {
  let canvases = { ...initial.canvases }
  let components = [...initial.components]
  const apply = (command: UICommand): CanvasDefinition | undefined => {
    if (command.kind === "set-theme" || command.kind === "set-renderer" || command.kind === "navigate") return undefined
    if (command.kind === "create-canvas") {
      if (canvases[command.canvasId] !== undefined) throw new UIError("invalid-tree", "duplicate canvas: " + command.canvasId)
      const canvas: CanvasDefinition = { canvasId: command.canvasId, title: command.title, nodes: {}, rootNodeIds: [], version: 1 }
      canvases[canvas.canvasId] = canvas
      return canvas
    }
    const canvas = canvases[command.canvasId]
    if (canvas === undefined) throw new UIError("not-found", "canvas not found: " + command.canvasId)
    if (command.kind === "insert-node") { const next = withNode(canvas, command.node, command.parentId, components.find((item) => item.type === command.node.type)); canvases[command.canvasId] = next; return next }
    if (command.kind === "link-canvas") {
      if (canvases[command.targetCanvasId] === undefined) throw new UIError("not-found", "target canvas not found: " + command.targetCanvasId)
      const next = withNode(canvas, {
        id: command.nodeId,
        type: "CanvasRef",
        props: { targetCanvasId: command.targetCanvasId },
        events: { click: [{ action: "navigate_to_canvas", input: { canvasId: command.targetCanvasId } }] }
      }, command.parentId, components.find((item) => item.type === "CanvasRef"))
      canvases[command.canvasId] = next
      return next
    }
    if (command.kind === "patch-node") {
      if (canvas.version !== command.expectedVersion) throw new UIError("version-conflict", "canvas version is stale")
      const node = canvas.nodes[command.nodeId]
      if (node === undefined) throw new UIError("not-found", "node not found: " + command.nodeId)
      const next = { ...canvas, nodes: { ...canvas.nodes, [node.id]: { ...node, props: { ...node.props, ...command.props } } }, version: canvas.version + 1 }
      canvases[command.canvasId] = next
      return next
    }
    if (command.kind === "bind-node") {
      if (canvas.version !== command.expectedVersion) throw new UIError("version-conflict", "canvas version is stale")
      const node = canvas.nodes[command.nodeId]
      if (node === undefined) throw new UIError("not-found", "node not found: " + command.nodeId)
      const next = { ...canvas, nodes: { ...canvas.nodes, [node.id]: { ...node, bindings: { ...node.bindings, [command.key]: command.binding } } }, version: canvas.version + 1 }
      canvases[command.canvasId] = next
      return next
    }
    if (command.kind === "remove-node") {
      const node = canvas.nodes[command.nodeId]
      if (node === undefined) throw new UIError("not-found", "node not found: " + command.nodeId)
      if ((node.children?.length ?? 0) > 0) throw new UIError("invalid-tree", "cannot remove node with children")
      const nodes = { ...canvas.nodes }
      delete nodes[command.nodeId]
      for (const [id, parent] of Object.entries(nodes)) if (parent.children?.includes(command.nodeId)) nodes[id] = { ...parent, children: parent.children.filter((child) => child !== command.nodeId) }
      const next = { ...canvas, nodes, rootNodeIds: canvas.rootNodeIds.filter((id) => id !== command.nodeId), version: canvas.version + 1 }
      canvases[command.canvasId] = next
      return next
    }
    return canvas
  }
  const registerComponent = (definition: ComponentDefinition): void => {
    if (definition.template?.type === definition.type) throw new UIError("invalid-tree", "recursive component template: " + definition.type)
    if (definition.template?.slot !== undefined && !(definition.slots ?? []).includes(definition.template.slot)) throw new UIError("invalid-tree", "undeclared slot: " + definition.template.slot)
    components = [...components.filter((item) => item.type !== definition.type), definition]
  }
  const unregisterComponent = (type: string): void => { components = components.filter((item) => item.type !== type) }
  return { apply, getCanvas: (id) => canvases[id], registerComponent, unregisterComponent, getComponent: (type) => components.find((item) => item.type === type), listComponents: () => [...components], snapshot: () => ({ canvases, components }) }
}
