# mantis operations quickstart

One process runs the whole product: web console (HTTP) + in-process MCP + host
sessions. The dingtalk robot runs as a separate channel host (same config).

## Run
    bun apps/mantis/src/hosts/webui/main.ts        # web console (HTTP :3737 default)
    bun apps/mantis/src/hosts/mcp/main.ts          # MCP server over stdio (for Claude Code etc.)
    bun apps/mantis/src/hosts/dingtalk/main.ts     # dingtalk robot channel host

pm2 (see apps/mantis/ecosystem.config.cjs):
    pnpm pm2:start:web && pm2 logs mantis-web

## Health / probes
    GET /api/health  -> {"ok":true,"startedAt":...,"approvalsOn":...}
    GET /api/state   -> full snapshot (conversations, pending approvals)

## Data layout (all under one instance dir; isolate per instance)
    MANTIS_UI_DIR            instance data root (SQLite workspace)  default apps/mantis/.ui

Everything reloads on restart. Production workspace state is stored in SQLite
under the configured data directory; use `:memory:` only for isolated tests.

## Approval gate (protected writes)
    MANTIS_PROTECTED=note_write,task_write   (comma-separated op names)
Approval wait: config.toml [approvals] timeoutMs (no env override).
Writes only pause when listed; everything else executes. Resolve from the web
console cards or POST /api/approval/resolve {callId, allow}.

## Config + model
config.toml (or MANTIS_CONFIG_FILE) sections: [agent] model/api/model.apiKey/baseURL/
maxSteps/maxReflections; [approvals] protectedTools/timeoutMs. Env expansion
supported. Real model keys are picked up by the standard MANTIS_* config path.

## Logging
    MANTIS_LOG_LEVEL (info default), MANTIS_LOG_FILE (optional JSONL sink).

## HTTP API (browser <-> MCP translation only)
    POST /api/message        {conversationId, text}
    GET  /api/conversation?conversationId=
    GET  /api/state          pending approvals
    GET  /api/workspace      resource declarations + records (sources: agent/ui)
    POST /api/workspace      {kind, text} operator write (stamped source "ui")
    PATCH /api/workspace     {recordId, text} operator update (source kept, new ts)
    DELETE /api/workspace?recordId=   operator delete (missing id -> graceful {ok:false,"no record..."})
    POST /api/approval/resolve {callId, allow}
    GET  /api/events?after= ; GET /api/health

## Release gates
docs/acceptance.md rows must be green (suite + live rows). Run:
    bun test                       (repo root; 220+ tests)
plus the live smoke steps in SELFUSE.md round notes.

## Notes
- Product display name is mantis; code identifiers stay mantis.
- Running multiple mantis processes on the SAME workspace/memory file is not
  supported (single writer); run one web host per instance dir, or one process
  serving all channels.

### Workspace write length (R23)
One record holds at most 50_000 characters (`src/tools.ts` `MAX_RECORD_TEXT`, the
single authority). Past that, REST and MCP return a readable error
`{ok:false, detail:"record text exceeds 50000 characters (got N)"}` — never a
silent truncation; a long payload truncated in the observation stream carries
the marker `"… (+truncated N chars)"`.
