# mantis for agents

mantis is built for agent use as much as for humans. Every capability is
exposed over plain JSON APIs (same origin as the web console) and through an
MCP server over stdio. There is no bespoke agent SDK: call the endpoints.

## Run an agent-facing instance

    MANTIS_WEB_PORT=3737 bun apps/mantis/src/hosts/webui/main.ts   # HTTP APIs
    bun apps/mantis/src/hosts/mcp/main.ts                          # MCP stdio

Both share the same data semantics: a durable workspace file and durable
conversation memory (see docs/ops.md). Restarting a process is safe: records,
conversation turns, AND each conversation's enabled extended tool set reload.

## Tool surface

MCP (server name "mantis") exposes the console bridge tools; the HTTP API maps
1:1. Every agent conversation is a "session" identified by conversationId —
that is the unit of memory, approval origin, and tool-surface persistence.

| MCP tool | HTTP route | Meaning |
|---|---|---|
| mantis_chat | POST /api/message | run one turn in a conversation (async: returns accepted; the reply lands in /api/conversation) |
| mantis_conversations | GET /api/state (conversations) | list conversations + turn counts |
| mantis_conversation | GET /api/conversation?conversationId= | full timeline (msg/tool/note entries) |
| mantis_pending | GET /api/state (pending) | approvals waiting on the operator |
| mantis_approve | POST /api/approval/resolve | answer a waiting approval {callId, allow} |
| mantis_workspace | GET /api/workspace | resource declarations + records incl source, PLUS capabilities[] = the full manifest surface (enable/read/update/delete discoverable without tools_catalog) |
| mantis_workspace_write | POST /api/workspace | operator write: {kind, text} stamps source "ui" |
| mantis_workspace_update | PATCH /api/workspace | change one record by id: {recordId, text} (source kept) |
| mantis_workspace_delete | DELETE /api/workspace?recordId= | delete one record by id (missing id -> error) |
| mantis_events | GET /api/events?after= | event ring since seq |
| mantis_state | GET /api/state | full snapshot |
| mantis_ui_latest/versions/restore | /api/ui/latest|versions|restore | agent-rendered A2UI surfaces |

Inside a conversation, the session agent itself plans against a layered tool
surface (not these bridge tools):

- core (always visible): tools_catalog, enable, recall_notes
- extended (visible after enable; persists across restarts per conversation):
  note_read, note_write, task_write, set_reminder, update_record, delete_record,
  ui_render

## Semantics agents should rely on

- Workspace records carry provenance: source is "agent" or "ui". recall_notes
  accepts {query, kind?, source?} - filter by who wrote a record. Humans and
  agents share one store per instance; records survive restarts.
- Conversation memory: prior turns render into each run; your conversation
  remembers across restarts. Re-enabling tools is not needed after a restart.
- Approval etiquette: when a write is protected (MANTIS_PROTECTED), the call
  pauses and a pending card appears for the operator with the asking
  conversation (session field). Do not treat "protected" as "don't act" -
  proceed with the write; the operator approves or denies.
- Form buttons from the operator arrive as [ui.action] NAME {values}: the
  operator already decided, so act on them (a protected write auto-pauses).
- Everything is declarative: kinds, write tools, catalog copy all come from
  the capability manifest + resource declarations - if the product grows a
  kind, the same APIs expose it.

## Quick HTTP examples (curl against a web instance)

    # one turn (conversationId is your session key); replies appear async
    curl -X POST localhost:3737/api/message -d '{"conversationId":"agent-a","text":"..."}'
    curl 'localhost:3737/api/conversation?conversationId=agent-a'   # poll for the assistant reply

    # look at the shared workspace with provenance
    curl localhost:3737/api/workspace

    # approvals: poll, then answer
    curl localhost:3737/api/state                       # read pending[0].callId
    curl -X POST localhost:3737/api/approval/resolve -d '{"callId":"...","allow":true}'

    # operator write (source "ui") / update / delete
    curl -X POST localhost:3737/api/workspace -d '{"kind":"task","text":"..."}'
    curl -X PATCH localhost:3737/api/workspace -d '{"recordId":"e5","text":"..."}'
    curl -X DELETE 'localhost:3737/api/workspace?recordId=e5'

## Boundaries

- One process owns a workspace/memory file (single writer). Run one mantis
  host per data root.
- ui_render surfaces render to the operator console and are versioned; they
  are an output channel, not a sandbox escape.
