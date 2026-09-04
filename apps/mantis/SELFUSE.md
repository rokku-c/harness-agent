# Self-use findings (round: state-first console + memory)

Found by using the system as a real user (real model, live HTTP flows), not by
code reading. Each entry: symptom -> root cause -> fix (or backlog).

## Fixed
1. Conversation memory was dead. "我上次和你说过什么话" always came back empty.
   - cause: history binding used `Effect.succeed`, which eagerly snapshots the
     transcript at session creation -> frozen forever. The agent never saw its
     later turns.
   - fix: `Effect.sync` (re-render on every materialize) in
     src/hosts/dingtalk/conversation.ts; regression test in test/memory.test.ts.
   - verified live: second turn correctly repeated "42" from turn one.
2. A decode failure (model returned prose, not FinalReply JSON) crashed the
   whole web console process (unhandled rejection -> Bun exit -> pm2 restart ->
   all in-memory conversations wiped mid-session).
   - fix: host.handle never rejects (digests + logs), deliver catches
     runPromise errors, failure callback surfaces a visible "note" entry in the
     conversation timeline. Regression test in test/failures.test.ts.
3. Race between smoke servers and the user's pm2 clawyp-web on :3737 caused
   misattributed results (old code / restarted process). Use a dedicated port
   for testing.

## Verified end-to-end (this round)
- Chat task -> agent calls tools (recall/enable/ui_render) -> UI versioned
  surface appears (official A2UI v0.9 renderers parse the batch).
- User clicks an action button (add_task) -> conversation receives
  "[ui.action] add_task" -> agent updates UI to a TextField + submit button
  form AND answers in chat. Full loop works.

## Backlog
- TextField input values never reach the agent: official v0.9 client->server
  messages are only action/error (no data-model push); a TextField's typed
  value only travels inside `action.context` if the button action binds a
  data-model path ({ path }) that the client has populated. Investigate @a2ui
  react/web_core input->data-model wiring (A2uiHost) so submit_task can carry
  the typed task text; until then, agents naturally fall back to "tell me in
  chat", which is acceptable UX but leaves the form button half-wired.
## Acceptance round 2 (independent subagent, real model, port 3740)
ALL PASS, no issues found:
- 记录三件事 task: msg+tool timeline complete, seq 1..22 strictly continuous, no duplicates.
- MEMORY SPOT CHECK PASSED: second message "我刚才让你记的第一件事是什么?" -> agent answered
  "第一件事是「周末买牛奶」" after recall_notes hits on e1/e2 notes.
- /api/ui/latest + /api/events?after=0 healthy JSON; zero non-200, zero process exits, clean warn logs.

## Round 2 findings (self-use + acceptance round 1 report + robustness)
- Acceptance round 1 (independent, real model, on OLD pre-fix code): "记录待办" task
  FAILED 4/4 - final replies never conformed to the FinalReply JSON contract
  (DecodeError -> AgentFailure -> no reply). Also observed the crash (now fixed).
- FIX (P0-2): structured-output recovery.
  a) decodeJson now extracts the last balanced JSON object from prose/code fences
     (packages/core/src/op.ts) - a fenced or prose-wrapped JSON reply decodes.
  b) EffectAgent Schema boundary re-asks up to decodeRetries (default 2) times when
     the final reply does not decode, feeding the parse error back
     (packages/builtin/src/loop.ts).
  c) clawyp instructions relaxed: brief prose allowed, JSON must end the reply
     (apps/clawyp/src/agent.ts).
  Tests: test/robustness.test.ts (4). Full suite 176 green, scoped tsc clean.
- VERIFIED LIVE after the fix (real model deepseek-v4-flash):
  * the exact task that failed 4/4 now replies in ~12s ("记三件事" -> notes +
    reminder, with an assistant reply).
  * a ui_render card task also replies in ~10s with a rendered surface.
- Chrome headless (remote-debugging + CDP over WebSocket, no deps) is available at
  /Applications/Google Chrome.app if a real-browser probe is needed later; note the
  --no-sandbox requirement on this machine and the crashpad noise.

## Round 3 findings (real-browser verification - the Agent UI was NEVER actually rendering)
- Root cause 1: official renderer roots the component tree at a component with
  the LITERAL id "root" (NodeResolver ROOT_COMPONENT_ID); Row/Column lay out the
  components their children array references. Agents emitted FLAT component lists
  with no "root" - the stored data looked fine but a REAL BROWSER showed
  "[Loading root...]" forever. Only full-browser verification caught it.
  FIX: ensureSurfaceRoot() in src/hosts/webui/a2ui.ts wraps every unreferenced
  top-level component under a synthetic root Column (batches with a "root" pass
  through). Tests in test/sanitize.test.ts.
- Root cause 2: agent-invented props (placeholder/style) failed the official
  STRICT zod schemas, blanking the WHOLE component. FIX: sanitizeComponent()
  strips unknown props for known basic catalog components (unknown components
  pass through so real errors stay visible).
- Root cause 3: the model only saw the binding recipe in the enable-catalog
  description, not in the ui_render OP description it reads when rendering.
  FIX: tools.ts ui_render description now teaches data-path bindings for forms.
- VERIFIED IN A REAL BROWSER (Chrome headless + CDP, no deps): after fixes the
  Agent UI renders; typing into the bound TextField and clicking submit produced
  POST /api/ui/action {"action":"submit_task","values":{"task":"读A2UI协议45分钟"}}
  and the real agent then note_wrote + set_reminder'd the task and replied.
  TextField -> data model -> action.context -> conversation round trip WORKS.
## Round 3 closing: approval flow verified live
CLAWYP_PROTECTED=note_write instance: agent's note_write call parked as a
pending card {callId, tool, input}; POST /api/approval/resolve allow:true
released it; the turn continued, note written, agent replied, pending=0.
Every objective path (chat, tools, A2UI render in a REAL browser, action round
trip with form values, approvals, state visibility) is now verified live on
the real model with the local config. 183 tests green, scoped tsc clean.
## Round 4: live user report - Card misuse blanking the surface
User's panel showed: "Validation failed for component 'Card' (card1): child:
Required, root: Unrecognized key(s): 'variant','children'" -> the agent had
used Card (official schema: single required child, NO variant/children) as a
container. Sanitize used to pass the bad component through on parse failure,
so the strict client schema still blanked the surface.
FIXED in src/hosts/webui/a2ui.ts sanitizeComponent: on parse failure a known
component now DEGRADES - children list is re-hosted as a Column (content
survives) or the node becomes a Text placeholder naming the skipped component
(the failure is visible but never blanks the surface). Also fixed a latent
bug in ensureSurfaceRoot: the single-top-level-component branch renamed the
root but dropped all its props (now spreads the original props).
Real-model check: agent rendered a task board (3 task cards with due dates) -
0 invalid Card nodes, valid tree (root->board Column->cards->texts), tests
cover the exact live Card variant/children scenario. 189 tests green, scoped
tsc clean. NOTE: previously stored bad UI versions replay as rendered errors
until the agent re-renders (history is stored as parsed messages); sanitize
applies to newly parsed renders only.
## Round 5: agent surface #9 - systematic misuse fixed by observation loop
Live dashboard surface showed mass "[unrendered ...]" degradations (Card x4,
Image, Button x2, TextField). Root habits found via official schema probes:
- TextField variant enum is shortText|longText|number|obscured (agents say "text")
- Button requires action.event.name (agents write action.name) and child prop is
  a REAL schema prop - my sanitize wrongly stripped it as a node-layer key
- Image url is called url, not src
- TextField label is REQUIRED (dropping it cannot help)
- children must be OTHER component ids, agents inline data objects
sanitizeComponent in src/hosts/webui/a2ui.ts now: strips unknown keys with
key renaming (src->url); retries with targeted repairs (invalid enum -> drop
prop; action without event -> wrap; single-child container promoted from
children; present-but-invalid optional prop -> drop); containers with plain
children id lists degrade to Column (no content lost); unfixable nodes become
a Text that NAMES the concrete zod issues (visible on screen, no guessing).
ui_render descriptions (tools.ts + agent.ts clawypSupply) now teach the
gotchas (label required, variant enum, action.event.name, url not src,
children reference ids). Real-model dashboard reproduction: 38 components,
0 unrendered (was 8+ on the same task). 195 tests green (16 in
test/sanitize.test.ts), scoped tsc clean.
## Product goal R1 (docs/product.md - "clew" workbench)
Single source of truth for the tool surface: apps/clawyp/src/capabilities.ts
manifest (name/tier/description/impl). supplyFromCapabilities derives the
supply registry (supply.ts); agent.ts clawypSupply is a derivation (hand copy
deleted); tools.ts op descriptions come from the manifest (drift impossible).
Regressions found & fixed: ui_render lost its name line during the description
extraction edit; deliver() swallowed AgentFailure so onTurnFailure (timeline
note) never fired - now called inside the catch with its own guard.
200 tests green (5 new in test/capabilities.test.ts), scoped tsc clean,
real-model smoke: tools_catalog -> enable -> note_write all normal.
## Product goal R2 (workspace resource declarations)
docs/product.md R2: apps/clawyp/src/workspace.ts declares resources
(note/reminder/task) - kind + append write cap (name/tier/description).
capabilities.ts assembles framework entries + resourceAppendCapabilities;
tools.ts kind unions + EntriesOut derive from the declarations and append ops
GENERATE per resource (task_write added); assembly order = manifest order.
test/resources.test.ts proves: per-resource single-sourced appends, a fake
"bookmark" resource flows into manifest+supply with zero hand-written code,
and task_write end-to-end stores kind=task while recall filters by kind.
208 tests green, scoped tsc clean.

## Product goal R3 (declarative human workspace UI)
docs/product.md R3: MCP tools clawyp_workspace + clawyp_workspace_write are
derived from WORKSPACE_RESOURCES (labels, write names, kind filter all from the
declaration); server routes GET/POST /api/workspace translate them; console.ts
gains WORKSPACE_CONVERSATION = "workspace" + web.workspace.records/append over
host.session(...).notes. Panel gains a Workspace tab (WorkspaceView.tsx) that
renders resources GENERICALLY (data-kind cards, quick-add per resource) - no
per-resource React anywhere. Verified: unit test round trip (11/11 webui),
live curl write+read, real Chrome headless: tab click, cards render label +
write badge + description + records, add task -> auto refresh shows it.
Build: bun run build:web (app-shell.js in public/). Operator writes are direct
(no agent turn, no approval); agent sessions share the store on the "workspace"
conversation.

## Product goal R4 (durable shared workspace + naming)
docs/product.md R4: NotesStore accepts {file} (append-only JSONL; reloads on
construction, id continues, corrupted lines skipped). makeClawyp accepts
options.notes; ClawypHost accepts workspace (injected into every session);
WebConsole accepts workspaceFile (owns ONE durable store); webui/mcp mains
default workspaceFile = <uiDir>/workspace.jsonl (CLAWYP_WORKSPACE_FILE
overrides, empty string disables). Naming: operator picked **mantis** for
display branding (panel header, index title, persona first line, MCP server
name); code identifiers + clawyp_* tool prefixes unchanged. Verified live:
human UI task write -> process restart -> record still there; separate agent
conversation recall_notes finds the human-written task. test/durable.test.ts.

## Product goal R5 (acceptance matrix + release smoke + polish)
docs/acceptance.md: layered acceptance matrix (L0 core -> approvals/A2UI ->
release smoke) with per-row evidence links. Polish: apps/clawyp/.gitignore
ignores .ui/workspace.jsonl (+ *.log); dingtalk main now honors
CLAWYP_WORKSPACE_FILE (explicit env; default unchanged, per-session stores).
Release smoke (live, real model): tools_catalog -> enable ui_render +
task_write -> A2UI form with TextField(/form/task) + Button submit_task ->
POST /api/ui/action {action:submit_task, values:{task:...}} -> agent receives
[ui.action], writes task "冒烟测试任务-按钮回传" into the shared workspace ->
GET /api/workspace shows it. Full loop green.

## Product goal R6 (product truth + record provenance)
Copy truth: note_read description and the session persona no longer claim
"this session" - the workspace is declared as shared + durable; persona now
mentions task_write and that humans/other agents see every record. Provenance:
Entry gains source ("agent" | "ui"); NotesStore.add stamps the default "agent",
human console writes stamp "ui" (console.workspace.append), JSONL persists it,
load backfills missing/unknown to "agent"; /api/workspace + Workspace UI show
ui/agent badges (MCP clawyp_workspace returns source). Live check: operator
record reads back source "ui". 213 tests green.

## Product goal R7 (durable conversation memory)
ConversationStore (hosts/dingtalk/conversation.ts) accepts {dir} and persists
every turn to <dir>/conversations.jsonl (auto-mkdir; reload on construct;
corrupt lines skipped). ClawypHostOptions.memoryDir; WebConsole.memoryDir;
webui/mcp mains default to <uiDir>/memory (CLAWYP_MEMORY_DIR override); dingtalk
main honors the env when set. After restart: conversations() lists restored
conversations, conversationTimeline() rebuilds msg entries from memory, and the
host history binding restores each agent's prior turns. NotesStore also now
auto-mkdirs its file directory. Tests in test/durable.test.ts (store reload +
rebooted-console restore); Live flow (real model): turn1 states the fact, restart the process, turn2 asks
"what release codename did we agree on?" -> agent answers MAN-7719 from memory.
215 tests green, tsc clean.

## Product goal R8 (provenance model-visible + filterable)
EntriesOut (recall/note_read/append outputs) now includes source ("agent"|"ui");
recall input accepts optional source filter; NotesStore.search filters by
source; recall_notes capability description documents the filter (single
source). test/resources.test.ts provenance test. Live flow: seed a ui task +
have the real agent write one, then ask it to list only operator-written
records (expected: Live (real model): it called recall_notes with {"source":"ui","kind":"task"},
got only the human record, and reported the agent-written task was correctly
excluded. 220 tests green, tsc clean.

## Product goal R9 (regression acceptance + agent-use discovery fix)
Acceptance matrix R9 re-run on the current build with CLAWYP_PROTECTED=task_write:
  1) protected agent write -> pending card -> operator approve {"ok":true} ->
     committed, source "agent" (live).
  2) A2UI form render (real model) -> button click [ui.action] -> agent now
     ACTS on it (guidance below) -> task_write pending -> approve -> the form
     task "受保护表单任务" lands with source "agent".
  3) operator seed record stays source "ui".
Agent-use finding: on a form submit the model initially replied "rendered
confirm UI, waiting for your decision" instead of writing (a protected write
pauses for approval by design). Fix: ui_render capability copy + persona now
state that [ui.action] values mean the operator already decided - act on them
(protected writes auto-pause). Re-run proves the fix (pending -> approve ->
landed ~12s). 220 tests green, tsc clean.

## Product goal R10 (deployability: health probe + ops doc)
GET /api/health added (server.ts): live liveness probe returning
{ok, startedAt, approvalsOn} derived from clawyp_state; webui.test covers it.
docs/ops.md: one-process architecture, run lines for webui/mcp/dingtalk mains,
health + state probes, data layout (uiDir / workspace.jsonl / memory dir) with
restart-reload semantics + gitignore guidance, approval gate config
(CLAWYP_PROTECTED + [approvals] timeoutMs from config.toml - no env override,
verified against webui main), HTTP API table, release gates, and the single
writer rule for shared durable files. Env claims cross-checked against mains.
221 tests green (health test added), tsc clean, live /api/health probe ok.
## Product goal R11 (user direction: build the UI with perry - spike)
User: use https://github.com/PerryTS/perry for the UI. Spike completed:
- perry 0.5.1220 (darwin-arm64 npm tarball) runs; needs PERRY_CACHE_DIR and PERRY_LIB_CACHE_DIR to writable dirs.
- perry/ui native UI compiles (App/VStack/Text/Button) -> 8.7 MB macOS binary.
- Native fetch target fails to link (missing _js_ext_http_agent_* ext objects in the prebuilt package); the same source compiles for web/WASM (239 KB html).
- Experiments live in apps/clawyp/experiments/perry-console (console.ts CLI probe, app.ts native window, README findings, DESIGN.md integration plan).
- No product source touched; the browser panel is unchanged.

R11 web finding (headless Chrome): perry.html serves 200 same-origin; the perry
UI page renders (Text + Button visible); direct fetch from that origin to
/api/workspace succeeds (no CORS). Perry web event-loop/module bootstrap under
a plain module page did NOT surface __perryCli/__perryResult within the probe
window - perry/ui web event wiring needs its runtime docs next round. Server
whitelist now serves /perry.html from src/hosts/webui/public/perry.html.

## Product goal R12 (perry web runtime deep-dive)
Headless probes (Chrome CDP) against perry-compiled pages served same-origin:
- perry web runtime RUNS sync callbacks: onFrame tick loop logged tick 1..3;
  setInterval registered before App() fires; console.log visible via CDP.
- await does NOT suspend on web in this build: module-level "await fetch" text
  rendered "[object Promise]"; inside a timer, await returned the promise
  object itself (label got "[object Promise]").
- Promise-only chains (.then after fetch) never completed - no microtask
  completion pump for async I/O on the web target.
- Reactive Text(`${state.value}`) painted "undefined" (State value not live).
Conclusion: perry 0.5.1220 prebuilt can render static UI + sync logic on web,
but network-driven dynamic UI is not reachable (async completion gaps) - and
the native target cannot link fetch (missing _js_ext_http_agent_* libs).
Track upstream releases (changelogs mention web promise/state work); until
then the React browser panel remains the production UI. /perry.html route +
static page kept for the next attempt. Experiments unchanged in
experiments/perry-console.

## Product goal R13 (enabled tool surface survives restarts)
Full conversation state across restarts: turns (R7) AND the extended tool
surface the agent enabled. Layers touched:
- supply.ts: ToolSupply.enabledExtended() snapshot.
- tools.ts: deps.onEnabled callback fired after a successful enable op.
- agent.ts: ClawypOptions.initialEnabled (pre-enables on session creation) +
  onEnabled; makeClawyp seeds the fresh ToolSupply from initialEnabled.
- conversation.ts: append-only {kind:"enabled",names} meta lines in the same
  conversations.jsonl (dedup, corrupt-line tolerant, reload on construct);
  enabled()/recordEnabled().
- host.ts: ClawypHost.session() passes initialEnabled = store.enabled(conv) and
  onEnabled = store.recordEnabled(conv, name) - so any host/console (webui,
  mcp, dingtalk) with a memoryDir restores each conversation's tool surface.
Tests: durable.test +2 (store meta reload incl dedup; rebooted WebConsole host
re-materializes a session whose supply already shows note_read). 223 green.

## Product goal R14 (approval cards carry the asking conversation)
Operator context for pending approvals: GateInput already carried session (the
host stamps conversationId), but the operator surface dropped it. Now:
- console.state()/api pending entries include session (derived from
  PendingApproval.input.session).
- ApprovalsView card shows "from conversation <id>" next to tool/callId.
- api.ts PendingItem.session; panel rebuilt (webui/public app-shell.*).
Tests: webui approval test asserts pending.input.session === "t2" and
state().pending[0].session === "t2". Live check: protected task_write from
conversation reqA -> /api/state pending {tool:"task_write", session:"reqA",
input:{...}} then approved and committed. 223 tests green, tsc clean.

## Product goal R15 (real-model proof: tool surface restores across restart)
Live (deepseek-v4-flash, webui main with memoryDir):
- turn A asks the agent to enable note_read -> it calls enable ->
  conversations.jsonl gains {"conversationId":"srv","kind":"enabled","names":["note_read"]}.
- process restarted; turn B in the SAME conversation: "do not enable; is
  note_read already visible?" -> agent answers VISIBLE (it saw note_read in its
  seeded tool list without calling enable).
- /api/health fine afterwards.
Completes the R13 story with a real-model restart, not just unit tests.

## Product goal R16 (agent onboarding doc)
docs/agents.md: how any external agent consumes mantis - run lines (HTTP +
MCP stdio), full bridge-tool/route table, layered session tool surface
(core/enabled+persistence), provenance & source filters, approval etiquette
(session context, act-then-pause), [ui.action] semantics, curl examples, and
boundaries (single-writer per data root). Every claim cross-checked against
server.ts / mcp.ts / host wiring (chat is async: accepted then poll
/api/conversation - doc corrected to say so).

## Product goal R17 (drop perry; workspace provenance filter, browser-verified)
User decision: abandon the perry UI route. Removed experiments/perry-console,
public/perry.html and its server route; roadmap R12/R11 marked DROPPED R17
(with history kept); no perry references remain outside history docs.
Same round shipped the human-side Workspace provenance filter: SegmentedControl
(All / Operator (ui) / Agent) filters each resource's records client-side over
the snapshot; count shows "shown/total" and "(none written by ...)" empty text.
Verified in a real browser (headless Chrome CDP, old-headless mode due to GPU
sandbox): seeded ui record OPERATOR-MARK-9E2 + real-model agent record
AGENT-MARK-7C1; All shows both, Agent hides operator's, Operator hides agent's,
All restores both. 223 tests green, tsc clean.

## Product goal R18 (code-level rename clawyp -> mantis)
User pushed back on clawyp everywhere (dirs, identifiers, envs, tool names).
Done: apps/clawyp -> apps/mantis; Clawyp*/clawyp*/CLAWYP_* -> Mantis*/mantis*/
MANTIS_* across 49 files (src/test/docs/ecosystem/scripts/bun.lock); pm2 apps
mantis-web/robot/dws; package app-mantis; MCP client mantis-*; logger scope
mantis. Env reads centralized in src/env.ts: MANTIS_* primary with CLAWYP_*
legacy fallback (existing shell/pm2 setups keep working; user's 3737 pm2
instance unaffected until restarted, after which it must run from
apps/mantis). Intentional remaining "clawyp": references to the ORIGINAL
external clawyp repo (config fallback path, compat comments, config.test
title, acceptance/SELFUSE history). 223 tests green, tsc clean, panel rebuilt.

## Product goal R19 (responsive UI: touch phones, mouse desktops, any ratio)
Requirement: the console must work on mobile/touch, desktop/mouse, any
aspect-ratio viewport. Implemented in the panel (pure client):
- useCompactViewport() (matchMedia <=700px, live updates) in common.ts.
- App.tsx: narrow = sticky bottom nav bar (5 big touch buttons w/ labels +
  count badges, 56px, env(safe-area-inset-bottom)); wide = original top tabs.
- ChatView.tsx: narrow = horizontal conversation strip above full-height
  timeline (single column); wide = left rail (236px).
- style.css: #root 100dvh, body overflow hidden, coarse-pointer
  touch-action, 16px inputs on narrow (no iOS auto-zoom), pre/code wrapping.
Verified headless (Chrome CDP device metrics): 1600x900 / 3440x1440 /
1024x768 / 768x1024 show top tabs, no bottom nav, zero overflow; 700x700 /
390x844 / 640x360 show bottom nav pinned exactly to the viewport bottom
(navBottom == innerHeight) with zero overflowing elements page-wide.
Screenshots /tmp/resp-1600.png + /tmp/resp-390.png. 223 tests green, tsc clean.

## R20 - record mutations + capability discovery (this build)
Shipped: update_record / delete_record as manifest capabilities (impl resource.update/.delete)
over generic record ids; NotesStore durable update/delete op-lines replay on reload;
operator REST PATCH/DELETE /api/workspace + MCP mantis_workspace_update/delete; Workspace
UI inline edit + delete on any record row (generic). Friction fix from the agent trial:
/api/workspace now ALSO returns capabilities[] (the full manifest surface: enable/read/
update/delete discoverable, no tools_catalog guessing).
Evidence:
- suite: apps/mantis bun test 87/87 (6 new mutation tests; surface-no-drift asserted).
- REST smoke (temp instance :3777, real model config): add task -> PATCH text -> list shows
  new text -> DELETE -> empty; bogus id PATCH/DELETE graceful {ok:false}; unknown kind graceful.
- real-model external-agent trial (conversation trial-ext-agent-r20, 2 turns, 40 tool entries,
  0 fails): enable x4 -> note_write (e4) -> task_write probe (e5) -> update_record e5 ->
  delete_record e5 -> turn2 update_record e4 -> task_write (e6) -> delete_record e6 ->
  recall lists e4(note v2) only; operator gate auto-approved 7 protected calls
  (approver log /tmp/mantis-trial/approver.log).
- discovery after fix: GET /api/workspace capabilities[10] incl update_record/delete_record.

## Product goal R22 (product pivot: 数字 worker + restrained dark UI)
User verdict on R21: clay skin wrong, IA cluttered - canvas v1 approved with
the positioning corrected by the user: "要一个和人一样能处理工作，但更快、
更可并行的 agent"。So mantis = a digital colleague: you delegate work, it
drives multiple work lines (one conversation each) with durable memory,
writes into the shared workspace with provenance, asks for approval on
protected writes; you supervise.
- Canvas rewritten: docs/product-canvas.md v1.
- Deleted the clay skin: theme.ts back to restrained dark (compact radii,
  dense, blue accent, primaryShade 6); app-shell forceColorScheme="dark";
  style.css rebuilt: no decorative layer, only A2UI dark remap + R19
  responsive chrome; index.html keeps style.css after app-shell.css.
- IA收敛 3+1: App.tsx nav now 会话 / 工作区 / 审批 (+右上最小状态: 审批门/
  已轮询)。Agent UI + Events tabs removed from the shell (views kept in the
  tree, unreachable); header/badges/status Chinese; store source filter
  全部/操作者(ui)/Agent; approvals copy describes the gate; ChatView copy:
  工作线/派活/发送/你 vs mantis.
Verified headless at :3737 (pm2 live): scheme dark (body #242424), 3 zh
tabs wide, workspace/approvals/chat screens render, compact 390x844 bottom
nav 会话/工作区/审批 pinned, zero overflow both sizes. Screenshots
/tmp/r22-1600.png + /tmp/r22-390.png. 231 tests green (38 files), tsc clean.
R23 plan: parallel work lines demo (two tasks at once, both complete) then a
photo review with the user.

## R21 全视口 UI 扫描（Store 行内编辑/删除 · 2026-09-03）
临时实例（MANTIS_UI_DIR=/tmp/msweep, :3799, 播种 5 条记录 note/task/reminder）用 Puppeteer 驱动 Chrome 152 验证：
- 视口 1600×900 / 1024×768 / 768×1024 / 390×844 / 360×640：doc 均无横向/纵向溢出；工作区 3 资源卡片 5 行全部渲染，行内 edit/delete 可见（360 下有 2 个需容器内滚动）；行内按钮 22×22px（<44px，触控偏小——见下）。
- 编辑 E2E（桌面）：点 edit → 输入聚焦 → 追加文本 Enter → PATCH 200 落盘（jsonl 两条 update op，文本回读含追加串）。
- 删除 E2E（桌面）：confirm dialog "删除这条记录？" → DELETE 200 → 行移除 + `{"op":"delete","id":…}` tombstone 落盘。
- 全链路零 JS 异常（空闲 15s 亦稳定）。
遗留：① 行内动作按钮 22px 对粗指针偏小，建议 coarse-pointer 提升至 ≥34px（对齐 board 的做法）；② 390px 触屏模拟下自动化键盘存盘不稳定（桌面正常），建议真机虚拟键盘过一遍。

## R22 粗指针触控目标（2026-09-03）
修复 R21 遗留：工作区行内编辑/删除按钮 22px → ≥36px。纯样式（style.css 在 Mantine 之后加载）：
- mantis：`[data-kind]` 作用域下 ActionIcon/Button/TextInput 在 `@media (pointer: coarse)` 时 min-height/宽 36px。
- board Worktable：行内操作 ActionIcon 与筛选 chips 同规则 36px。
验证（Puppeteer + Chrome 152, 390×844 isMobile+touch）：两侧 `(pointer: coarse)` 均命中；board 行内 36×36、chip 57×36；mantis edit/delete 36×36、添加按钮 57×36；均无横向溢出、零 JS 异常。

## R23 - no silent data loss (2026-09-03)
Trials flagged two frictions: silent "…" truncation of long tool payloads and no
length warning for very long texts. Hardened + tested:
- tools.ts: `MAX_RECORD_TEXT=50_000` single authority - NotesStore.add/update throw
  a readable "record text exceeds …" Error; generated append ops and
  update_record convert it to an explicit `Effect.fail` (agent + operator REST
  paths see the reason, nothing is silently cut).
- console.ts: `short()` now marks dropped length "… (+truncated N chars)" in the
  observability/timeline stream instead of a bare ellipsis; session-failure
  note uses it too (exported for tests).
- new test/truncation.test.ts (7 cases: boundary/over/update-preserve/durable-file
  pollution + marker). Suite 87→94 pass, 371 expects.

## Product goal R24 (approval loop end-to-end + same-conversation guard)
Core loop A "protected write -> card -> operator verdict -> continue/archive"
verified live end-to-end on an isolated console (MANTIS_WEB_PORT 3751,
MANTIS_PROTECTED=note_write,task_write, approve timeout 300s, separate
ui/workspace/memory under /tmp/mantis-ap):
- Approve: agent asked to note_write; /api/state showed 1 pending
  {tool:note_write, session:"approve-me"}; the panel rendered the zh card
  (等待操作者 + tool + session + 同意/拒绝 - screenshot /tmp/r24-card.png);
  resolve allow=true -> agent resumed and the record landed with source=agent.
- Deny: task_write from "approve-deny" pending -> resolve allow=false ->
  agent still replied but NO task record exists (gate held).
- Console.ts gained an in-flight guard (#inflight set around host.handle in
  handleMessage/chatSync/chatFire): a second message to the same conversation
  is rejected immediately ({accepted:false,"conversation busy"}) and is not
  recorded; the running turn was unaffected (busy-one finished catalog ->
  recall -> note after its own approval was released).
Evidence summary JSON kept in round notes; screenshots /tmp/r24-card.png.
231 tests green, tsc clean. R23 parallel results unaffected.

## R23b - REST/MCP cap path fix (2026-09-03)
R23 单元绿后做真实接口冒烟（临时实例 :3800，REST /api/workspace）：
超限(50001) add/patch 曾返回 500 "JSON Parse error" —— 两个根因：
① mcp.ts zod schema 曾写死 max(4000)（且与域上限不一致）; ② zod 违规走 SDK 原始报错，
append/update 抛错未被转译。修复：zod 只保结构（min(1)），域上限(MAX_RECORD_TEXT=50_000)
为唯一权威；mcp 写/改 handler try/catch 把 Error 转成 isError "error: ..."。
现在：10k 正常写入 ok；50001 add/patch → HTTP 200 {ok:false, detail:"record text exceeds 50000 characters (got 50001)"}；
坏 kind 同样优雅；原记录不受污染。mcp.test 新增 2 例（oversized append 不落库、
oversized update 不破坏原记录），套件 94→96 pass (377 expects)；scoped tsc 干净。

## Product goal R25 (external agent over MCP stdio + hygiene + stability)
- Fixed a real defect: the MCP stdio server logged to STDOUT (consoleSink uses
  console.log) which corrupts the JSON-RPC transport for real clients. mcp/
  main.ts now routes diagnostics to stderr (or file) and leaves stdout clean.
- Found and repaired an out-of-band truncation of hosts/webui/console.ts
  (file ended mid-chatFire): reconstructed the missing tail (chatFire finish,
  resolveApproval, handleUiAction, conversations, pendingApprovals, the
  workspace operator-surface getter, state(), restoreUi + module eventHook)
  against the real consumer surface (mcp.ts tools, server routes).
- The live model gateway began requiring BAIZHI_API_KEY around 17:0x local
  (401 "缺少 API Key"); no key exists in this shell/pm2 envs, so live-model
  runs are paused until the user supplies it. Earlier live evidence (R22-R24)
  predates the auth flip and stands.
- Added apps/mantis/test/console-flow.test.ts: the console roundtrip now has
  automated coverage under a SCRIPTED model - chatSync reply + durable turn,
  interleaved conversations keep their own replies (ALS attribution), and the
  R24 in-flight guard rejects a same-conversation double-send. 3 tests.
- Loop.ts (structured output by another contributor) had two regressions fixed
  for the suite: final-tool toolError used before its const (hoisted) and the
  plain-text Schema fallback now re-asks through the retry budget instead of
  failing on the first non-conforming reply (robustness tests green).
248 tests green (41 files), tsc clean.

## Product goal R26 (approval loop automated, model-free)
- The approval loop now has permanent automated coverage that needs NO live
  model or API key: apps/mantis/test/approvals-flow.test.ts drives a scripted
  agent through the real product flow (tools_catalog -> enable note_write ->
  protected note_write -> final_answer) and asserts:
    approve  -> call sits in pendingApprovals (session attributed to the
                conversation, args visible) and resolve(true) lands the record
                in the shared workspace with source "agent"; turn closes.
    deny     -> call clears, NO record persists, and the turn still finishes.
  (Earlier first attempts protected a tool that is not initially active, so
  nothing ever gated - the flow had to enable note_write first, like the real
  product path.)
- Full regression now 250 tests / 42 files green, tsc clean.
- Re-checked every plausible local source for the gateway key: shell env, all
  user rc files, harness-agent/.env (only LLM_API_KEY, an unrelated service ->
  401 "invalid"), pm2 process envs. The gateway flipped to mandatory auth
  around 17:00 local; live-model demos stay paused until the user provides
  BAIZHI_API_KEY (blocker round 2).

## Product goal R27 (restart trust automated + visual review package)
- Restart trust now covered WITHOUT a model: a fresh console over the same
  dirs (memoryDir + workspace file) sees the earlier message again (counting
  model answers saw:2) and the earlier workspace record is still there -
  canvas loop C pinned by console-flow.test.ts (4 tests).
- New visual review package of the current product UI (evidence files):
  /tmp/r27-1600-chat.png, /tmp/r27-1600-workspace.png,
  /tmp/r27-1600-approvals.png, /tmp/r27-390-chat.png - shot against the live
  3737 console (dark restrained theme, 会话/工作区/审批 tabs, mobile 390).
- Full regression: 251 tests / 42 files green, tsc clean.
- Live-model blocker (BAIZHI_API_KEY missing since the gateway enforced auth)
  is at its third goal round; model-free work continues meanwhile.

## Product goal R28 (parallel loop-split refactor integrated + verified)
- A parallel refactor split packages/builtin loop into packages/builtin/src/loop/
  (types/protocol/cycle/turn/execute/decide; loop.ts is now a barrel). Mid-flight
  it broke the suite (9 fails). Fixed two regressions to make the split land green:
    protocol.ts finalToolFor required until.asTool - with Until.schema(FinalReply)
    (no asTool) the final_answer tool silently vanished from the model surface.
    Default name restored (DEFAULT_FINAL_TOOL_NAME = "final_answer").
    cycle.ts call-less Schema replies failed once (decide) - restored the
    decode-retry budget re-ask (robustness expects 3 model calls then Left).
    Also: driver.ts runCycle result typed A prematurely (unknown -> as unknown as A),
    robustness test cast via unknown (root test is outside the compile baseline scope).
- Also added model-free coverage: workspace update/remove through the operator
  surface + ui version snapshot contract tests (console-flow now 6 tests).
- Verified: full suite 253 tests / 42 files green; tsc clean on the compile
  baseline. Live-model blocker (BAIZHI_API_KEY) unchanged; demo still paused.

## Product goal R29 (MCP stdio external-agent contract pinned in-repo)
- New apps/mantis/test/mcp-stdio.test.ts: spawns the REAL stdio server the way
  an external agent (Claude Code config) would and asserts the R25 hygiene
  contract permanently, no network/key needed:
    - stdout carries ONLY parseable JSON-RPC frames (zero stray/non-JSON lines)
    - initialize succeeds (server name "mantis")
    - tools/list advertises the full mantis_* surface (>=14, incl chat,
      conversation, pending/approve, workspace read/write/update/delete,
      events, state, ui latest/versions/restore)
    - mantis_state round-trips (approvalsOn present) without a live model
- The parallel loop-split author tightened robustness semantics: plain-text
  Schema replies now FAIL ONCE with a readable cause (their AGENTS.md rule),
  while malformed protocol tool calls retry the decode budget. cycle.ts
  reverted to that contract (removed my earlier re-ask block); their new
  robustness test + all others green.
- Verified: 254 tests / 43 files green; tsc baseline clean. Live model demos
  still paused (BAIZHI_API_KEY blocker unchanged).

