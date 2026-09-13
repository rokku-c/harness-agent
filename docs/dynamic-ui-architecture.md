# Dynamic canvas and component system plan

## Conclusion

The goal is "declarations define the building blocks, the Agent composes them at runtime, and the
renderer is replaceable". A canvas is a component too, so it can nest, reference each other, and be
clicked to drill down. Definition, data, behaviour, and visual implementation must be separated.

FastMCP does not go into the core: the repository already has the TypeScript MCP SDK and `ui-agent`,
which are enough to expose tools; FastMCP serves as a standalone bridge only if a Python ecosystem is
needed in the future. Gradio does not go into the product runtime;
it suits Python model demos/validation only.

## Layers and packages

### Main runtime (the existing effect-agent chain)

|Layer|package|Responsibility|Nature|
|---|---|---|---|
|L0|`core`|Agent/Until/Op/Binding/Driver protocols|core, stable|
|L1|`model` `channel` `tools`|model, message channel, tool/MCP contract|core interfaces; implementations replaceable|
|L2|`state` `memory`|Store, EventLog, Checkpoint, long-term memory|core interfaces; persistence built in|
|L3|`builtin`|default Agent loop, ClaudeCode, providers|built-in default implementations|
|L4|`gate` `schedule` `script`|approval, scheduling, sandbox scripts|optional built-in capabilities|
|L5|`assembly`, `apps/*`|composition root, product Host|application layer|

Dependencies point upward only; `assembly` is the single composition root; the same layer cooperates through Tag/interfaces.

### Dynamic UI chain (parallel to the main chain)

1. `ui-protocol`: DSL, nodes, events, permissions, errors; zero business dependencies.
2. `ui-definition`: Component/Canvas definitions, props schema, slots, versioning and catalog.
3. `ui-runtime`: tree/graph instances, command transactions, binding resolution, history, navigation stack.
4. `ui-renderer`: RendererRegistry and the recursive render Host; default web-html.
5. `ui-extension`, `ui-sandbox`, `ui-agent`: dynamic registration, script isolation, Agent/MCP adaptation.

The repository already has these 7 UI packages; keep the boundaries and do not stuff UI detail into `core`.

## Core data model

```ts
type ComponentDef = { type: string; kind: 'base'|'composite'|'canvas';
  props: Schema; slots?: Record<string, NodeSpec>; renderers?: string[] }
type NodeSpec = { id: string; type: string; props?: unknown;
  bindings?: Record<string, Expr>; events?: Record<string, Action[]> }
type CanvasDef = ComponentDef & { kind: 'canvas'; children: NodeSpec[] }
```

The Registry stores only declarations and renderer references, never React/Vue instances. Composite
components reference base or composite types through `NodeSpec`; a CanvasRef points at any CanvasDef.
Definition (schema) and implementation (renderer) are separated, and an extension must carry version,
permission, and capability declarations.

## Data binding and drill-down

- `DataStore` holds remote sources, caches, and local state; `UIDataSource` plugs in through the
  asynchronous `read(signal)` interface, `syncDataSource` writes the snapshot into the store; every
  Canvas creates a `Scope` carrying its parent chain. Optional `invalidate()` clears the TTL cache
  immediately after a mutation.
- Bindings allow only safe paths/expressions: `$scope.user.id`, `$data.sales.items`, `$event.row`;
  `eval` is forbidden. Read and write actions pass schema validation and the Gate.
- Clicking a CanvasRef produces `navigate(canvasId, params)`, writing the params into the child Scope;
  `currentCanvasStack` supports going back, refresh recovery, and deep links; a child canvas is isolated
  by default and reads `$parent` per declaration.

## Rendering and dynamic capabilities

The Renderer interface takes a resolved Node + Scope and returns a mount handle and an event outlet.
Implementations such as `web-html`, React/Vue, React Flow/Konva, tldraw, Three/WebGL can be registered;
switching renderer replaces only the handle, leaving the data and node IDs unchanged. ThemeRegistry
provides design tokens (CSS variables) overridden global→canvas→node, so re-skinning needs no DSL change.

Complex or high-risk logic uses `DynamicScriptHost`: the script runs in a Worker/iframe/QuickJS
sandbox, receives data and actions through capability injection, can only update declaration state,
and cannot operate the host DOM directly.

## Agent API and landing order

The Agent calls commands only: `registry.list/register`, `canvas.create/insert/link`,
`node.patch/remove`, `binding.set`, `set-data`, `navigate`, `theme.set`. Commands are auditable and
replayable, and `ui-agent` maps them to MCP; a node event can update the DataStore with the `set_data`
action, which likewise turns into a `set-data` command. The theme registry injects tokens into the
renderer context; a future FastMCP bridge does protocol conversion only.

Implementation order: freeze the protocol/definition schema first → fill in runtime transactions and
persistence → default web renderer/CanvasRef drill-down → theme and renderer hot-swap → sandbox →
collaboration/remote plugins. Every stage keeps the existing tests and the 100-line-per-file lint constraint.
