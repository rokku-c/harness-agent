# Doop adoption list

Reference repo: `/Users/user/repos/doop` (main, 2026-09-07). Doop is a multiplayer design canvas;
its core object is Canvas → Frame, a Frame holds HTML and morphs incrementally inside a sandbox iframe; an Agent
creates and stream-edits Frames over MCP.

## Worth adopting directly

1. **A usage guide as part of the MCP contract**: Doop's `get_guide` lets the Agent first learn the workflow,
   dimensions, style and collaboration rules. Our `ui-agent` should offer a one-shot protocol/interaction guide,
   but the rules must come from the capability/catalog, not from a hidden prompt.
2. **Incremental generation**: `append_frame_html(start/done)` lets observers watch progress live. The counterpart here should
   use json-render's RFC 6902 `SpecStream`, with every outer patch still written to the UI journal.
3. **Agent presence and task status**: `set_status`, heartbeat, task queues and an activity feed tell people
   who is doing what. This belongs in the host/product layer, not in `ui-protocol`'s general node schema.
4. **Restart recovery semantics**: on startup Doop marks interrupted tasks as retryable failures, avoiding a permanent stuck-in-working state.
   Our journal/runtime should likewise give an interrupted state to incomplete SpecStream records.
5. **Server-authoritative access control**: every MCP canvas/frame operation does an owner/member access check first, and the
   Agent identity inherits the authorizing user; you cannot rely on the frontend hiding buttons alone.
6. **Design memory and human confirmation**: Doop layers guideline, reference, decision and proposal,
   and a rule becomes a persistent guide only after a person accepts it. That suits productization better than automatically stuffing all past conversation into the prompt.
7. **Safe rendering boundary**: Doop puts untrusted HTML into a sandbox iframe and sanitizes scripts/HTML.
   We stay with json-render's declarative catalog; a separate sandbox comes into play only if custom HTML is allowed in future.

## Not copied over as-is

- Doop's HTML Frame is not our canonical model; it cannot provide catalog-level props validation or
  cross-React/Vue/Svelte renderers. We stay with the json-render Spec as the UI base.
- Doop's multiplayer presence, comments and memory belong to the product collaboration layer; they should not be stuffed into `@json-render/core`.
- Doop's MCP tools are product actions; this project still audits uniformly through Effect Op + Gate + UICommand.

## Current implementation order

1. Add an incremental patch adapter from `SpecStream` → UICommand/journal.
2. Add a minimal product interface for Agent status/activity to ui-host.
3. Wire canvas access control into the MCP and HTTP command entry points.
4. Then build the optional guidelines/reference/decision memory package.

FastMCP and Gradio are still not needed: Doop's value is in its protocol and product runtime semantics, not in its Python UI framework.
