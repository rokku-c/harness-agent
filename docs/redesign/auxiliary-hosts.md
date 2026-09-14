# Auxiliary hosts

Every UI surface that is not the console shell and not a declared app view. Paths are relative to
the repository root.

Read: `apps/mantis/src/hosts/webui/**` (54 source files; two `.gitkeep` excluded),
`apps/mantis/src/hosts/dingtalk/**` (34), `apps/mantis/src/hosts/mcp/**` (7),
`apps/board/src/hosts/**` (29), `apps/deckconsole/public/**` (12) plus the eight
`apps/deckconsole/src/effect-ui-*.ts` modules and `apps/deckconsole/src/http/assets.ts` that serve
it, and the `src/` of `packages/ui-agent` (2), `ui-definition` (2), `ui-extension` (1),
`ui-protocol` (2), `ui-renderer` (3), `ui-runtime` (11), `ui-sandbox` (1), `effect-interface`
(11). Test files are not classified.

## 1. Each surface described

**Mantis web panel — `apps/mantis/src/hosts/webui/**`.** A standalone HTTP host that serves a
built React panel out of one directory and, behind it, translates every `/api` call into one call
on an in-process mantis MCP server (`InMemoryTransport`, `main.ts:73-77`). Transport: HTTP page
plus JSON/SSE-style polling; the browser never speaks MCP directly. Users: an operator watching
and driving agent sessions. A user can read whole-console state, read the event ring from a
cursor, list conversations, read one conversation's full timeline (messages plus tool steps), send
a message (fire-and-poll or waited out), create a conversation id, see pending protected calls,
allow or deny one, read the declarative workspace (resource kinds, labels, write capability,
records, full capability surface), and append, update or delete a workspace record directly. The
same `api.ts` handler is what the platform console embeds, without the panel assets
(`server/assets.ts:9-13`).

Capabilities: health/state snapshot; event poll by timestamp cursor; conversation list with turn
counts; per-conversation timeline; send message with `wait`; pending-approval list; approval
verdict (allow/deny); workspace read; workspace record append/update/delete; three tabs (chat,
workspace, approvals) with a compact touch layout.

**Mantis DingTalk host — `apps/mantis/src/hosts/dingtalk/**`.** A chat-card host: mantis runs
behind a DingTalk robot or behind the `dws` CLI speaking as the logged-in user. Transport: chat
cards and chat messages. Inbound is either `dingtalk-stream` `TOPIC_ROBOT` messages plus
`TOPIC_CARD` button callbacks (`channels/robot/channel.ts:27-43`), or a poll loop over
`dws chat message list` (`channels/dws/channel.ts:53`). Outbound approval cards go through the
DingTalk card openapi `createAndDeliver` with `callbackType: "STREAM"` (`card/deliver.ts:32`);
replies go to the message's `sessionWebhook`, proactive sends through `robot/oToMessages` or
`robot/groupMessages`. Users: the bot's owner or a group. What a user can do: message the agent
and get a reply; receive a protected call as a real interactive card carrying the tool's own
arguments; press 同意 or 拒绝, which resolves the waiting gate from the card's `outTrackId`.
Duplicate and stale clicks are ignored (`host/class.ts:53-60`). Startup refuses when protected
tools are set without an owner or without a card template (`main/approval.ts:39-51`), and the dws
channel refuses without `meUserId` because it would otherwise answer itself forever
(`channels/dws/source.ts:19-28`).

Capabilities: robot or dws channel; per-conversation sessions; durable SQLite conversation memory;
protected-tool policy over a shared `ManualGate`; interactive card delivery; card-click verdict;
webhook replies; openapi proactive sends; per-conversation approval adapter; turn serialization;
failure visibility.

**Mantis MCP host — `apps/mantis/src/hosts/mcp/**`.** The same mantis wiring exposed to other
agents as tools over stdio (`main.ts:52`). Transport: MCP stdio; diagnostics go to stderr so
stdout stays JSON-RPC. Users: agent clients such as Claude Code. Tools: `mantis_chat` (with
`wait`), `mantis_conversations`, `mantis_conversation`, `mantis_events`, `mantis_state`,
`mantis_pending`, `mantis_approve`, `mantis_workspace`, `mantis_workspace_write`,
`mantis_workspace_update`, `mantis_workspace_delete`.

Capabilities: drive a session turn and read its reply, or fire and poll events; enumerate
conversations; read a full timeline; read the whole-console snapshot; see and resolve pending
approvals; read and write the declarative workspace.

**Board web host — `apps/board/src/hosts/web/**`.** A standalone listener serving a vanilla-JS page
and CSS plus `/api/*`, where `/api/` is the projection of the board's operation list through
`toHttpHandler` (`server.ts:14`). Transport: HTTP page plus JSON. Users: an operator of the task
board. Five views: board (columns), tree, table, calendar, documents. A user can create, edit and
delete tasks (title, body, state, start/due times, parent), filter by state and free text, open
the change-event log, create and delete outline documents, and edit an outline: insert, rename,
toggle, delete, indent, outdent, move up/down, with each edit sent against the version the tree
was built from and re-read on a refusal.

Capabilities: task read/create/update/delete; state and text filter; five views; event log dialog;
document list/create/delete; outline op application with expected version; agent/run presence
readout.

**Board MCP host — `apps/board/src/hosts/mcp/**`.** The same operation list registered as MCP
tools over stdio (`board-mcp.ts:12`). Users: agent clients. Capabilities: every board operation,
invoked as a tool.

**Deck console legacy client — `apps/deckconsole/public/**`.** A dark control-room page served by
`src/http/assets.ts` from an allow-list of module names. Transport: HTTP page plus JSON, with a
2500 ms full refresh (`client/main.js:44`). Users: an operator of the agentdeck deck. A user can
open a session of a chosen kind with a label and a consent policy (auto-approve tool list, default
decision), add and remove launchers, quick-launch one, send a turn to a session row, trigger a
demo approval, close one session or all, read the session→consent mapping table, read the consent
flow table, allow/deny a single pending call or bulk allow, preview a raw agent config as the
unified config plus the spawn plan, and load a sample config.

Capabilities: session list; open session; send turn; close session; close all; session detail
(recent turns plus consent log); consent flow list; per-call allow/deny; bulk allow; launcher
add/remove/quick-launch; config normalisation preview.

**Deck console declarative view — `apps/deckconsole/src/effect-ui-*.ts`.** The same deck rendered
as a `UiNodeSpec` document (the deck is also reached through the platform console). Transport: the
console's declarative view, not a page of its own. Users: an operator. Screens: a header with
doors to the catalog and to "open session"; a pending-consent table with Allow/Deny per row; a
sessions table with Open and Close; a session room with the turn form and the transcript; a
catalog of launchers and presets with a Remove press; a kind picker built from the deck's served
kinds.

Capabilities: read pending consent; allow/deny; read sessions; open a session; send a turn; read a
transcript; read launchers and presets; remove a launcher; navigate between screens.

**The `ui-*` packages.** Not surfaces: the model behind agent-authored UI. `ui-protocol` is the
wire contract (nodes, canvases, components, extension manifests, commands); `ui-definition` is the
canvas/component store with its tree and version rules; `ui-extension` enables and disables
component extensions under a permission check; `ui-runtime` applies commands, resolves bindings,
holds the data store, navigates, and journals/replays streams; `ui-renderer` turns a resolved tree
into markup (a string renderer and a React renderer) under a theme registry; `ui-sandbox` runs an
extension's script behind permission validation; `ui-agent` exposes the canvas ops to an agent as
tools. Transport: whatever the embedding host uses; no surface of their own.

**`effect-interface`.** Not a surface: one operation declared once and projected to two transports
(`toHttpHandler`, `toEffectTools`), a registry of interfaces with reversible registration, and the
tool-key/schema derivation.

## 2. Presentational / non-presentational split

### `apps/mantis/src/hosts/webui` — 21 presentation, 33 non-presentational

Presentation: `panel/App.tsx`, `panel/app-shell.tsx`, `panel/theme.ts`, `panel/common.ts`,
`panel/schema/render.tsx`, `panel/schema/spec.ts`, `panel/schema/types.ts`,
`panel/shell/header.tsx`, `panel/shell/nav.tsx`, `panel/views/ApprovalsView.tsx`,
`panel/views/ChatView.tsx`, `panel/views/WorkspaceView.tsx`, `panel/views/chat/composer.tsx`,
`panel/views/chat/rail.tsx`, `panel/views/chat/rows.tsx`, `panel/views/chat/timeline.tsx`,
`panel/views/workspace/resource-paper.tsx`, `public/index.html`, `public/app-shell.css`,
`public/style.css`, `public/app-shell.js`. (`app-shell.js`/`app-shell.css` are build artifacts of
`panel/`; they are presentation but must be regenerated, not hand-deleted.)

Non-presentational:

- `bus.ts:20` — `class Bus` holds the event ring and the subscriber set; `after(ts)` is the cursor
  both `/api/events` and the MCP `mantis_events` tool advance.
- `console.ts:8` — barrel exporting `MAX_CHAT_TEXT` (a wire limit) and `WORKSPACE_CONVERSATION`
  (a store key), not a view. *uncertain: re-export only.*
- `console/approvals.ts:24` — `requires` decides which tool calls are protected; `resolveApproval`
  is the verdict itself.
- `console/console.ts:57` — the facade owns the gate, the workspace store and the host;
  `resolveApproval` is reached from the panel, the MCP host and DingTalk alike.
- `console/event-hook.ts:18` — a `Harness.hook` that attributes harness events to a conversation
  from AsyncLocalStorage.
- `console/helpers.ts:9` — `short()` truncates payloads for the event stream and states how much
  it dropped. *uncertain.*
- `console/host-builder.ts:40` — constructs the `MantisHost` with the console's approval, hook and
  failure-notice seams.
- `console/ledger.ts:42` — `begin()` opens a timeline onto durable history and numbers entries;
  the property is proven in `Formal/Timeline.lean`.
- `console/snapshot.ts:24` — `timelineOf` chooses live vs stored; `workspaceSurface` is the write
  path (`append`/`update`/`remove`) into the notes store.
- `console/turn-runner.ts:29` — `#guard` enforces empty/length/busy admission; `#inflight`
  serialises one turn per conversation.
- `console/types.ts:44` — `MAX_CHAT_TEXT` and `WORKSPACE_CONVERSATION`: wire limit and persistence
  key.
- `embedded-model.ts:14` — builds a fallback model when no API key is configured.
- `main.ts:73` — the standalone entry; wires the in-process MCP pair and the logger sinks.
- `server.ts:8` — barrel over the HTTP surface.
- `server/api.ts:28` — one HTTP request becomes one MCP call; owns the 404 and 500 verdicts.
- `server/assets.ts:24` — the served asset table and the mount rewriting applied to the built
  markup; the transport for the panel's own files.
- `server/helpers.ts:25` — `callText` issues the tool call; `parseJsonLines` parses the answer.
- `server/mount.ts:13` — `baseOf`/`internalPath`/`prefix`/`prefixApi` decide which path a request
  means. *uncertain: string arithmetic, but it decides routing.*
- `server/serve.ts:23` — the `Bun.serve` shell; the one place the standalone surface is declared.
- `server/routes/approvals.ts:14` — the operator's allow/deny is submitted as `mantis_approve`; the
  body shape gates a 400.
- `server/routes/conversation.ts:18` — parses the JSON-lines tool answer into entries.
- `server/routes/message.ts:31` — refuses empty text and chooses fire vs awaited turn.
- `server/routes/state.ts:14` — `/api/health` liveness and the `after` cursor arithmetic.
- `server/routes/workspace.ts:22` — direct operator writes with no agent turn and no approval; owns
  the 400 gates.
- `panel/api.ts:39` — the typed HTTP client and every payload shape. *uncertain: it is the view's
  data source.*
- `panel/store.ts:8` — barrel exporting the `panel` singleton. *uncertain.*
- `panel/store/actions.ts:19` — sends the message and decides what a rejection means locally.
  *uncertain.*
- `panel/store/core.ts:20` — the mutable state container and the per-conversation timeline cache.
- `panel/store/panel.ts:27` — the two poll timers and the event-ring cursor.
- `panel/store/poll.ts:11` — polls snapshots; a failed poll flips `pollOk`.
- `panel/store/selectors.ts:22` — `conversationItems` splices local notes into the backend timeline
  by timestamp. *uncertain: a merge rule.*
- `panel/store/singleton.ts:5` — one store instance per page. *uncertain: module-level state.*
- `panel/store/types.ts:16` — the panel state contract.

### `apps/mantis/src/hosts/dingtalk` — 0 presentation, 34 non-presentational

Presentation: none in this directory. The card's own look is a template configured in the DingTalk
developer console; the only card text written here is the literal in `main/approval.ts:62`.

- `card/callback.ts:27` — `findAction` reads the verdict only from fields named `action`; proven in
  `Formal/CardVerdict.lean`.
- `card/deliver.ts:17` — fetches a token and POSTs `createAndDeliver` to the DingTalk openapi.
- `card/types.ts:13` — `approvalOutTrackId`/`callIdFromOutTrackId` map a call id to the card's
  track id; `approvalCardParamMap` is the card payload. *uncertain: the param map is the card's
  presentation data.*
- `card/walk.ts:21` — generic payload walking (`unwrapJson`, `findString`, `actionsOf`).
- `channels/dws.ts:6` — barrel.
- `channels/dws/channel.ts:53` — the poll loop, the seen-set dedupe and the cursor advance.
- `channels/dws/parse.ts:35` — drops the user's own messages; the only thing preventing a
  self-answer loop.
- `channels/dws/runner.ts:13` — spawns the `dws` CLI (the transport).
- `channels/dws/source.ts:35` — conversation identity and the CLI arg shapes for list/send.
- `channels/mock.ts:8` — test channel that records everything sent. *uncertain: test scaffolding.*
- `channels/openapi.ts:10` — access-token fetch and cache.
- `channels/robot.ts:7` — barrel.
- `channels/robot/channel.ts:27` — registers the `TOPIC_CARD` callback that resolves approvals.
- `channels/robot/parse.ts:25` — normalises raw stream messages and drops non-addressable ones.
- `channels/robot/sdk.ts:28` — lazy SDK loader (the transport).
- `channels/robot/send.ts:13` — `sessionWebhook` reply and openapi sends.
- `conversation.ts:6` — barrel.
- `conversation/binding.ts:15` — renders history into the session context on every run.
- `conversation/contract.ts:9` — `Turn` and the store options (schema).
- `conversation/store.ts:25` — the SQLite tables and the reload that restores memory.
- `dingtalk-card.ts:6` — barrel. *uncertain.*
- `dingtalk-stream.d.ts:6` — type stub for the optional dependency.
- `host.ts:7` — barrel.
- `host/class.ts:53` — `handleCardAction` resolves the gate from a card click; `deliver` records
  and runs the turn.
- `host/contract.ts:17` — the host options and approval contract.
- `host/policy.ts:12` — the per-conversation approval adapter that carries the session id.
- `host/queue.ts:17` — per-conversation turn serialisation and failure digestion.
- `host/sessions.ts:29` — the session registry; restores the enabled surface and the history
  binding.
- `main.ts:31` — the live entry that assembles host, channel and approval.
- `main/approval.ts:39` — refuses startup without an owner or a card template; `requires` decides
  protection.
- `main/card.ts:17` — wires a deliverer only when the robot channel has a template. *uncertain.*
- `main/channel.ts:23` — robot vs dws selection. *uncertain.*
- `main/setup.ts:21` — config and logger bootstrap. *uncertain.*
- `messages.ts:10` — the `IncomingMessage`/`Reply`/`OutgoingTarget`/`MessageChannel` contract.

### `apps/mantis/src/hosts/mcp` — 0 presentation, 7 non-presentational

- `main.ts:52` — stdio entry; the stderr sink keeps stdout clean for JSON-RPC.
- `mcp.ts:8` — barrel. Its doc names a `ui.ts` module that does not exist in the directory.
- `mcp/approvals.ts:31` — `mantis_approve` resolves the shared gate, with the same semantics as the
  panel and DingTalk.
- `mcp/assembly.ts:22` — registers the three tool domains over the `WebConsole` seam.
- `mcp/helpers.ts:11` — `chatId` bounds ids over the wire; `text`/`err` shape the reply envelope.
- `mcp/lifecycle.ts:26` — `wait: false` fires a turn and the reply arrives as an event; the rest
  reads the console.
- `mcp/workspace.ts:44` — `mantis_workspace_write` is a direct operator write, no agent turn and no
  approval.

### `apps/board/src/hosts` — 20 presentation, 9 non-presentational

Presentation: `web/public/index.html`, `web/public/app.css`, `web/public/style.css`,
`web/public/dialog.css`, `web/public/docs.css`, `web/public/dom.js`, `web/public/dates.js`,
`web/public/cards.js`, `web/public/board-view.js`, `web/public/tree-view.js`,
`web/public/table-view.js`, `web/public/calendar-view.js`, `web/public/render.js`,
`web/public/doc-view.js`, `web/public/doc-list.js`, `web/public/outline-node.js`,
`web/public/editor.js`, `web/public/editor-fields.js`, `web/public/events.js`,
`web/public/app.js`.

Non-presentational:

- `web/public/api.js:24` — `applyOp` sends an operation against an expected version; the endpoint
  set is a transport surface. *uncertain.*
- `web/public/state.js:7` — the client store; `visibleTasks` owns the filter and sort. *uncertain.*
- `web/public/state.js:13` — `displayState` reads `rollup.state`; that rule is proven by
  `Formal/Rollup.lean` over `board/src/tasks/rollup.ts`, which is outside this directory.
  *uncertain.*
- `web/public/outline-ops.js:19` — sends each op with the version the tree was built from and, on a
  refusal, re-reads the document instead of retrying.
- `web/assets.ts:7` — allow-lists servable file names and substitutes `__BASE__` into the page.
- `web/server.ts:14` — projects the operation list onto `/api/` and owns the fallback 404.
- `web/main.ts:7` — binds host and port and installs the signal handlers.
- `settings.ts:12` — reads the environment into the settings declaration, including
  `incompatibleStore`.
- `mcp/board-mcp.ts:12` — registers the same operation list as MCP tools.
- `mcp/main.ts:6` — the stdio entry.

### `apps/deckconsole` (public, effect-ui neighbours, http/assets) — 17 presentation, 4
non-presentational

Presentation: `public/index.html`, `public/app.css`, `public/client/main.js`, `public/client/dom.js`,
`public/client/tables.js`, `public/client/detail.js`, `public/client/flow.js`,
`public/client/launchers.js`, `public/client/config.js`, `src/effect-ui.ts`,
`src/effect-ui-catalog.ts`, `src/effect-ui-consent.ts`, `src/effect-ui-header.ts`,
`src/effect-ui-history.ts`, `src/effect-ui-kinds.ts`, `src/effect-ui-nodes.ts`,
`src/effect-ui-session.ts`.

Non-presentational:

- `public/client/api.js:3` — resolves the API URL from the served module and surfaces failures.
- `public/client/actions.js:32` — `decide(callId, allow)` posts the approval verdict;
  `openSession` composes the session id and the consent policy.
- `public/client/state.js:1` — module-level store for fetched launchers and samples. *uncertain.*
- `src/http/assets.ts:2` — the allowed module list and the `__DECK_BASE__` substitution.

### `packages/ui-agent`, `ui-definition`, `ui-extension`, `ui-protocol`, `ui-renderer`,
`ui-runtime`, `ui-sandbox`, `effect-interface` — 4 presentation, 29 non-presentational

Presentation: `ui-renderer/src/index.ts` (emits HTML, owns escaping and theme tokens),
`ui-renderer/src/json-react.ts` (React renderer), `ui-renderer/src/theme.ts` (token registry),
`ui-runtime/src/json-render.ts` (builds a `@json-render` spec).

Non-presentational:

- `ui-agent/src/index.ts:29` — the canvas ops an agent drives; `patchNode`/`bindNode` carry the
  version the caller read so the refusal is armed.
- `ui-agent/src/binding.ts:10` — `uiBinding` exposes the canvas ops as agent tools (`Op.write`).
- `ui-definition/src/index.ts:49` — the `version-conflict` refusal and the tree rules (duplicate
  node, children, nesting, required props).
- `ui-definition/src/builtins.ts:3` — the built-in component catalogue and its capabilities
  (schema).
- `ui-extension/src/index.ts:32` — refuses an extension whose components lack the `render`
  permission; enable/disable rebuild from baseline.
- `ui-protocol/src/index.ts:35` — `ExtensionManifest.permissions` and the `UICommand` union
  (schema).
- `ui-protocol/src/errors.ts:1` — the error codes.
- `ui-runtime/src/actions.ts:10` — the navigation stack; `dispatch` runs a node's actions.
- `ui-runtime/src/data.ts:12` — the data store; `forbidden` guards `__proto__`/`constructor`/
  `prototype`.
- `ui-runtime/src/index.ts:27` — `resolveBinding`/`resolveCanvas`: template expansion and binding
  resolution.
- `ui-runtime/src/journal.ts:14` — persists every command to a log and replays it.
- `ui-runtime/src/runtime.ts:16` — the `UIRuntime` that applies commands and holds
  theme/renderer selection.
- `ui-runtime/src/source.ts:12` — `fetchDataSource`: a network data source.
- `ui-runtime/src/spec-journal.ts:16` — persists spec patches; `recover` reports an interrupted
  stream.
- `ui-runtime/src/spec-session.ts:21` — decodes journal records and computes recovery state.
- `ui-runtime/src/spec-stream.ts:11` — applies parsed JSON patches to a spec. *uncertain.*
- `ui-runtime/src/sqlite-log.ts:8` — the ordered append log; serialized appends that would
  otherwise share one key.
- `ui-sandbox/src/index.ts:14` — `validateSandboxRequest` refuses oversized code, unknown
  permissions, a missing `execute:script`, and undeclared dependencies.
- `effect-interface/src/index.ts:1` — barrel. *uncertain.*
- `effect-interface/src/contract.ts` — the tool/interface contract; zod is type, validator and JSON
  Schema at once.
- `effect-interface/src/registry.ts` — the interface and tool registry.
- `effect-interface/src/revocable.ts:19` — the per-registration token; proven in
  `Formal/Lifecycle.lean`.
- `effect-interface/src/tool-key.ts:23` — `keyOf`/`schemaOf`; proven in `Formal/ToolKey.lean`.
- `effect-interface/src/surface/fields.ts:8` — `noInput` (strict) and `csv` (schema).
- `effect-interface/src/surface/http.ts:73` — `toHttpHandler` projects operations to HTTP.
- `effect-interface/src/surface/index.ts:9` — barrel.
- `effect-interface/src/surface/match.ts:5` — `bindPath` and input matching.
- `effect-interface/src/surface/operation.ts` — the `Operation` declaration (schema).
- `effect-interface/src/surface/tools.ts:13` — `toEffectTools` projects operations to tools.

## 3. What proves what

Modules whose header comment names a file under these directories:

| module | file it models | property it proves |
| --- | --- | --- |
| `formal/Formal/CardVerdict.lean` | `apps/mantis/src/hosts/dingtalk/card/callback.ts` | The verdict is read only from fields named `action`, and two actions naming different verdicts are no verdict — so a tool argument that spells "approve" cannot decide its own approval, and an injected token beside the real click is refused rather than obeyed. |
| `formal/Formal/Timeline.lean` | `apps/mantis/src/hosts/webui/console/ledger.ts` and `apps/mantis/src/hosts/webui/console/snapshot.ts` | A timeline is opened onto the conversation rather than started beside it, so the turn after fifty recorded ones is the fifty-first; a timeline nobody opened onto numbers its next turn one. |
| `formal/Formal/ToolKey.lean` | `packages/effect-interface/src/tool-key.ts` | A dot-free interface id splits a flattened key into exactly the pair that built it, while two tool names can sanitize to one served name — and the surface refuses that instead of dropping a tool. |
| `formal/Formal/Lifecycle.lean` | `packages/effect-interface/src/revocable.ts` (the README row names `effect-interface/src/registry.ts`) | Register and dispose are symmetric, and a stale disposer cannot revoke the registration that replaced it. |

Adjacent, and load-bearing for files in scope: `formal/Formal/Rollup.lean` models
`apps/board/src/tasks/rollup.ts`, which is outside these directories, but the rule it proves is
read only at `apps/board/src/hosts/web/public/state.js:13` and
`apps/board/src/hosts/web/public/tree-view.js:48-54`; deleting those files deletes the only UI of
a proven rule. `formal/Formal/TreeOrder.lean` models `apps/board/src/tasks/tree-order.ts`, which
has no reader under `apps/board/src/hosts`. No formal module names a file under
`apps/mantis/src/hosts/mcp`, `apps/deckconsole`, or any `ui-*` package.

---

178 files classified: **62 presentational, 116 non-presentational**. Only two directories are
mostly presentation (`webui/panel`, board `web/public`), while the DingTalk and MCP hosts and all
eight `ui-*`/`effect-interface` packages are behaviour that merely lives beside a UI — and four of
those files are pinned by Lean proofs.
