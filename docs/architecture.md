# mantis architecture - per-layer contracts

mantis is built bottom-up; EVERY layer declares on top of the layer below and
nothing reaches across more than one layer. A declaration is plain data that a
layer below interprets - adding capability never means writing per-feature UI,
per-feature ops or per-feature copy twice (single-source rule).

## L0 core - effect-agent algebra (packages/core, packages/builtin ...)
- Symbols/Tag/Layer, Agent/Until/Op/Binding/Driver, EventLog, Store, Gate
  (packages/*). mantis consumes, does not fork.
- Contract: an "op" = { name, access read|write, input/output schema,
  execute }. Effect.Succeed/Fail returns; failures are recoverable tool errors.

## L1 capabilities - one manifest (apps/mantis/src/capabilities.ts)
- A capability = { name, tier core|extended, description, impl, kind? }.
- impl is an enum: catalog | enable | notes.search | notes.read |
  resource.append | resource.update | resource.delete | ui.render
- The manifest is assembled from FRAMEWORK + generated resource capabilities
  (workspace.ts WORKSPACE_RESOURCES); supply registry, session ops and catalog
  all derive from it (tests prove no drift: capabilities.test.ts).
- Contract: adding a capability = one manifest entry + one impl branch in
  tools.ts; the surface (supply/catalog/MCP) updates itself.

## L2 workspace resources - one schema (src/workspace.ts)
- ResourceDecl { kind, label, write:{name,tier,description} }; kinds today:
  note | reminder | task. Append ops generate per kind (one per declaration).
- Records: { id ("e<seq>"), kind, text, ts, source: "agent"|"ui" } in the
  shared NotesStore (tools.ts). Mutations update_record / delete_record are
  GENERIC record capabilities (by id) declared once in the manifest.
- Durability: append-only JSONL (workspace.jsonl). Lines are records or op
  lines {op:"update"|"delete",...}; reload replays in order. Corrupted lines
  are skipped, id sequence continues.

## L3 surfaces - derived, no per-tool code
- Human UI (webui/panel): renders from /api snapshots; Workspace view renders
  resources + records + generic edit/delete from the declarations.
- Agent surfaces: session ops (L1 impls) + MCP bridge (hosts/mcp) +
  HTTP shell (hosts/webui/server.ts) that is ONLY a browser<->MCP translator.
- Approval seam: tools.ts wraps every op with the ApprovalPolicy; protecting
  an op is an explicit config choice, never implied by access=write.

## L4 channels / hosts
- WebConsole (webui/console.ts): state source; owns ONE shared NotesStore
  (workspaceFile) + conversation memory (memoryDir); single writer per data
  root. dingtalk host is a peer channel over the same session engine.

## Declarations you can read to see the whole product
- capabilities.ts (manifest) -> workspace.ts (kinds) -> tools.ts (impls) ->
  supply.ts (tier registry) -> agents.md (surface contract) -> acceptance.md.
