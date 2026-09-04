# app-mantis

mantis on effect-agent - the mantis ideas as ordinary effect-agent concepts,
no mantis code copied. One package, three sides:

1. **the session agent** (`src/`): `makeMantis(model)` - tools, approvals,
   context economy, reflection, the FinalReply contract (library, used by
   tests and every host).
2. **the dingtalk host** (`src/hosts/dingtalk/`): the REAL entry - mantis
   talking to DingTalk over two channels (robot / dws), configured from the
   ORIGINAL mantis config.toml.
3. **the web console** (`src/hosts/webui/`): observability + access over
   HTTP/SSE - chat with mantis from the browser, resolve approvals, watch
   live events, and host agent-rendered (A2UI-style) UI surfaces.

| mantis mechanism | expression here |
|---|---|
| hidden final_reply_resolution control tool | the agent's OUTPUT TYPE: `Agent.define(...).returns(Until.schema(FinalReply))` |
| context economy / supply-side activation | `EffectAgent.planTools` + `ToolSupply`: the model starts on the core surface and grows it via `enable` |
| reflection signals | `EffectAgent.reflect`: one observe-only prompt after a failed tool step (agent.reflection.max_passes) |
| pending confirmation | `ApprovalPolicy`: protection is EXPLICIT per call (default: none - writes flow); protected calls wait on a `ManualGate` operator console (Deferred wait + `onPending` event, no polling) |
| workspace memory | `NotesStore` behind recall/note ops (notes + reminders, one append log) |
| reply review | `FinalReply` schema: reply / tone / asksConfirmation |

Approvals are not implied by write access: `makeMantis` takes an optional
`approvals` policy and `noApproval` (everything executes) is the default.

## Config: the original clawyp config.toml works

`src/config.ts` reads a TOML config with the original loader's semantics and
discovers it in this order (env `MANTIS_CONFIG_FILE` first):

1. `apps/mantis/config.toml` (copy `config.example.toml`)
2. the original clawyp repo's config.toml (a sibling repo, auto-detected)

Values like `"$DINGTALK_CLIENT_ID"` are expanded from the environment.
Keys the new engine still honors are mapped ([dingtalk] client_id/
client_secret, [agent] provider_type/model/api_key/base_url/max_steps,
agent.reflection.max_passes -> reflect passes). Every other original key or
section (web, tools.*, tool_context, tool_result_processing,
tool_confirmation, tool_registry, mcp_servers, agent.autonomy, agent.progress,
... the whole legacy surface) is reported as **deprecated** on startup and
ignored - the file never has to be trimmed.

```bash
# your existing config, unchanged:
MANTIS_CONFIG_FILE=~/repos/clawyp/clawyp/config.toml bun run start
# or drop the file at apps/mantis/config.toml and it is found automatically
```

## Logging: a leveled logger with file persistence

`@effect-agent/logger` is a small shared logger (leveled, scoped,
composable sinks - console is just one sink). The host injects it everywhere:

- **session events** (tool calls, outputs, start/completion/failure) flow from
  the driver's HarnessEvent hooks into the logger per conversation
  (`session.log.<conversationId>` scope);
- **errors** (approval card send failures, session turn failures) are logged
  as error entries - never fatal;
- production: `MANTIS_LOG_LEVEL` (default info) + `MANTIS_LOG_FILE` append
  structured JSON lines while console stays on:

```bash
MANTIS_LOG_FILE=logs/mantis.jsonl MANTIS_LOG_LEVEL=debug bun run start
tail -f logs/mantis.jsonl   # {"ts":"...","level":"info","scope":"mantis.session.<cid>","message":"session started",...}
```

Embedding hosts can pass their own `logger` (MantisHost option) instead; the
default is silent so libraries never print by accident.

## Web console: observability + access (webui host)

A compact panel (no framework, plain HTML/CSS/JS + JSON/SSE APIs) that
observes and drives the whole mantis system:

- **Chat** - send messages to mantis from the browser; every conversation is a
  real mantis session (same MantisHost + conversation memory as dingtalk);
- **Approvals** - the page IS the operator: protected calls render as pending
  cards and resolve with one click (same ManualGate as every other host);
- **Agent UI** - sessions render UI by emitting the **official A2UI v0.9
  protocol** (a2ui.org) through the `ui_render` tool: createSurface +
  updateComponents messages with Basic Catalog components (Text/Row/Column/
  List/Button/TextField/... children reference component ids). Rendering in
  the panel uses the official renderers - `MessageProcessor` (@a2ui/web_core)
  + `A2uiSurface`/@a2ui/react - there is no custom component schema. Every
  accepted message batch is **versioned**: a numbered git-tracked JSON file
  under `apps/mantis/.ui/` (`MANTIS_UI_DIR`); rollback from the page
  (restore = a new version authored by owner-restore). UI is real A2UI data
  under git - diffable and reversible;
- **Events** - session activity, replies, approvals, tool steps and log
  lines stream over SSE (recent 200 kept).

The panel never talks to the backend directly: every /api call is translated
by a thin Bun.serve shell onto the in-process mantis **MCP server**
(InMemoryTransport), and the SSE stream polls `mantis_events` - the web
console is just another MCP client, exactly like Claude Code.

The console chrome is a React + Mantine single page (sources under
`src/hosts/webui/panel/`). It is STATE-FIRST: the console records every
conversation turn (message.in -> tool steps -> reply) into per-conversation
timelines and serves them as snapshots (`mantis_conversation` / the
`/api/conversation` HTTP route), so the panel simply polls state every ~700ms
and renders it. There is no event-stream subscription anywhere: nothing to
reconnect, replay or dedupe. Views: a conversation timeline that folds the
agent's tool steps (call/ok/fail + payload summaries) between messages,
pending approval cards, the versioned agent-UI surface (rendered by the
OFFICIAL A2UI renderer embedded in the same tree -
`panel/a2ui/A2uiHost.tsx`) and an event ring read via stateless `?after`
polls.

```bash
bun run build:web        # bundle the React+Mantine panel into public/app-shell.{js,css} (after npm installs)
bun apps/mantis/src/hosts/webui/main.ts        # http://127.0.0.1:3737
# env: MANTIS_WEB_HOST / MANTIS_WEB_PORT / MANTIS_UI_DIR + the standard
# MANTIS_* config/model/protected env of every host
```

The web host shares the live config: same config.toml model, same
`MANTIS_PROTECTED` policy. pm2: `mantis-web` in ecosystem.config.cjs.

Try it end-to-end from the chat tab: “enable ui_render and render a status
board” - the agent pushes a surface, the Agent UI tab shows it versioned.

## MCP server: other agents drive mantis as tools

`src/hosts/mcp/` exposes mantis to any MCP client (Claude Code, IDE agents)
over stdio. It is a third host of the same wiring: config.toml model,
`MANTIS_PROTECTED` policy, identical approval semantics (WebConsole reuse).

| tool | purpose |
|---|---|
| `mantis_chat` | `{conversationId, text}` - run one mantis session turn, return its FinalReply text (same id = continued conversation) |
| `mantis_conversations` | conversations seen by this server + turn counts |
| `mantis_pending` | protected calls waiting for the operator |
| `mantis_approve` | `{callId, allow}` - resolve a pending ask (this server IS the operator) |

Claude Code:

```jsonc
// ~/.claude.json → "mcpServers"
{ "mantis": { "command": "bun", "args": ["run", "apps/mantis/src/hosts/mcp/main.ts"], "cwd": "<this repo root>" } }
```

Note: a protected call hangs the `mantis_chat` turn until approved or
`MANTIS_APPROVE_TIMEOUT_MS` elapses (default 60s → Deny) - give the MCP
client a tool timeout above that, or keep writes unprotected (the default).

## DingTalk host: two channels, one bot app

| channel | identity | mechanism | needs |
|---|---|---|---|
| dws | the logged-in USER | polls `dws chat message list*`, replies with `dws chat message send` | `dws` CLI installed + logged in, a target group/direct user |
| robot | the BOT (like the original clawyp) | `dingtalk-stream` TOPIC_ROBOT websocket, replies via sessionWebhook; outbound + approval cards via the openapi | DingTalk robot app: [dingtalk] client_id/client_secret |

    IncomingMessage (conversationId / text / sender ...)
      |
      v
    MantisHost  -- one mantis session agent per conversation --> FinalReply
      |          (workspace + history isolated per conversation)
      +-- approval console: shared ManualGate; protected calls wait, each
      |   Ask goes to the owner as an interactive card (button click resolves)
      v
    Reply --> dws send / robot webhook

### Approvals: interactive cards (robot channel)

Protected calls (`MANTIS_PROTECTED=note_write`) hang on the shared
ManualGate. Every Ask is sent as a REAL DingTalk interactive card
(`card/instances/createAndDeliver` + `callbackType: "STREAM"`): the owner
clicks 同意/拒绝 and the button click arrives on the dingtalk-stream
TOPIC_CARD subscription and resolves the call via its outTrackId - **no text
parsing, no chat replies, no textual fallback**. An approval channel without
`[dingtalk] card_template_id` refuses to start (there is no degraded mode).

Template contract (developer console): variables `content`, `tool`,
`input`, `callId`; two buttons whose STATIC callback payload is
`{"action":"approve"}` and `{"action":"deny"}`. The call id rides the
card's outTrackId (`mantis-approval-<callId>`), so the template needs no
dynamic parameters. approve: the waiting session commits the write; deny: the
write becomes a recoverable tool error the agent answers ("I did not write
it"). No operator at all: the Ask times out (`MANTIS_APPROVE_TIMEOUT_MS`,
default 60s) into Deny.

### Daemon (pm2)

`ecosystem.config.cjs` declares one process per channel: `mantis-robot`
and `mantis-dws` (auto-restart, logs under `logs/`). pm2 is a repo
devDependency (installed by `bun install`).

```bash
export DINGTALK_CLIENT_ID=... DINGTALK_CLIENT_SECRET=... BAIZHI_API_KEY=...
bun run pm2:start          # both channels   (in apps/mantis)
bun run pm2:start:robot    # or just one
```

From the repo root: `bun run mantis:pm2:start` / `mantis:pm2:robot` /
`mantis:pm2:dws` / `mantis:pm2:logs`. Secrets are `$ENV` placeholders
expanded from the starting shell's environment - never hardcoded.

Files:

- `src/supply.ts` - tiered tool supply (core always, extended on enable) + catalog
- `src/tools.ts` - domain ops (catalog/enable/recall/note read-write/reminder)
- `src/approval.ts` - the ApprovalPolicy seam (requires/ask) + withApproval wrapper
- `src/final.ts` - the FinalReply reply contract
- `src/agent.ts` - `makeMantis(model)`: the assembled session agent
- `src/config.ts` - config.toml loading (original-config compatible) + deprecation notices
- `src/hosts/dingtalk/` - the live host: messages/conversation/host/dingtalk-card/channels
- `examples/stdin.ts` - interactive operator-console example
- `test/` - agent + host tests (mock dingtalk channel drives the whole approval flow)