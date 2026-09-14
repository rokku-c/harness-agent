# json-render adoption and migration decision

## Decision

Adopt `vercel-labs/json-render` as the generative-UI foundation, and stop extending our own generic
Spec, StateStore, catalog, binding, action, stream patch, and framework renderer.

Current experimental evidence:

- The StateStore of `@json-render/core@0.20.0` has already replaced the `UIDataStore` core, and the old tests pass unchanged.
- A Canvas can be converted into the official `Spec`, keeping nodes, slots, path binding, actions, and CanvasRef.
- `@json-render/react@0.20.0` is the console client's runtime, and every declared view is lowered
  server-side into its Spec and drawn by it. There is no second renderer and no `set-renderer`:
  the host's own page and the in-house renderer behind it were removed, so the console is the one
  surface a canvas is read on.
- Full-repo regression 348 pass, 3 skip, 0 fail.

## The product layer we keep

These are not json-render's responsibility and continue to be maintained by this repository:

- Multi-Canvas graphs, CanvasRef targets, and the drill-down/back navigation stack.
- The command transactions by which an Agent modifies the UI, optimistic versions, the audit journal, and recovery.
- Gate/permissions, the extension manifest, the dynamic script capability sandbox.
- effect-agent Ops and the product MCP tools; FastMCP does not enter the core.

## Package handling

| package | Handling |
|---|---|
| `ui-protocol` | shrink to the product protocols (Canvas, commands, permissions); switch generic node/action types to core |
| `ui-definition` | becomes a json-render Catalog + multi-Canvas definition repository |
| `ui-runtime` | keeps navigation/transactions/journal; state, Spec, and patch are delegated to core |
| `ui-renderer` | **gone.** The official renderer is the console client's runtime, so the package and the in-house HTML recurser it still carried were deleted rather than kept as a selection between two renderers for one node vocabulary |
| `ui-agent` | keeps the Op/MCP → product command adaptation, without copying the catalog schema |
| `ui-extension` | keeps the plugin lifecycle, with component registration landing in the Catalog |
| `ui-sandbox` | kept as the optional untrusted-code execution boundary |

No eighth long-term package is added; migration adapters live in their own layer and are deleted once the migration is done.

## Migration gates

1. Replace the hand-written component constraints with official Catalog validation, and verify base/composite components.
2. Replace `ActionRef` and the in-house path/template resolution with the official action/state binding.
3. Replace the node-level hand-written patch logic with RFC 6902 patch/SpecStream, keeping UICommand recorded on the outside.
4. Delete `webRenderer` once the official renderer covers CanvasRef, theming, and host events.
5. Every step keeps Canvas drill-down, journal recovery, MCP, and the full-repo tests passing.

Gradio is still not needed: it is a Python demo UI, not this product's dynamic canvas runtime.
