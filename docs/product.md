# mantis — a declarative workbench for humans and agents

> Product plan for turning the mantis experiment into a mature product.
> Product name chosen by the operator: **mantis** (R4). Display branding only -
> code identifiers, MCP tool prefixes (mantis_*) and package names stay mantis
> until a package-level rename is approved.

## What the product is

One workbench, two users, one shared reality:

- **for humans** — a console where every agent action is visible, approvals
  are cards you click, and agent-rendered surfaces (A2UI) are first-class output;
- **for agents** — the SAME product facts and capabilities are reachable as a
  tool surface (session ops), an MCP surface, and declarative data bindings,
  so an agent and a human act on the same workspace without two models of truth.

## The build rule: each layer is declared on top of the layer below

| layer | content | declared how |
|---|---|---|
| L0 core | Effect-Agent algebra: Agent/Until/Op/Binding/Driver, EventLog, Store, Gate | symbols + Tag/Layer (exists) |
| L1 capabilities | what the product can do | capability manifest: name / tier / description / impl |
| L2 session | one manifest entry -> op + catalog + approval metadata | impl branches in tools.ts (exists: capabilities.ts) |
| L3 surfaces | human console, agent tool/MCP view, A2UI | derived from manifest + EventLog; no per-tool UI code |
| L4 channels | dingtalk robot/dws, web, future hosts | pure adapters over the same session agent |

Round 1 state: the capability manifest exists and is the single source for
supply + session ops + catalog descriptions; tests prove no drift
(apps/mantis/src/capabilities.ts + test/capabilities.test.ts).

## Gap list (what 'mature' still needs)

1. Resources: append + recall/read GENERATE from declarations (R2/R20);
   CRUD (update/delete) now exists as generic record capabilities (R20).
2. UI from declarations: manifest -> automatic operator UI (resource panels,
   A2UI write forms, catalog view) without hand-written React per tool.
3. Agent usability loop: scriptedModel acceptance tests per capability + a
   real-model smoke per release (chat, notes, reminders, ui_render, approvals).
4. Naming: settle the product name + console branding (page title, header).
5. Persistence: NotesStore is in-memory per process; promote to the
   EventLog/Store layer so console and hosts share one durable workspace.
6. docs/architecture.md: per-layer contract + declaration schemas, kept current. (created R20) -> docs/architecture.md

## Roadmap (one unit per iteration)

- R20 (done): record mutations as declarations - update_record / delete_record
  are manifest capabilities (impl resource.update / resource.delete) over a
  GENERIC record id; NotesStore gained durable update/delete op-lines that
  replay on reload; operator REST PATCH/DELETE /api/workspace and the MCP
  mantis_workspace_update/delete mirror them; the Workspace UI edits and
  deletes any record row inline (generic, no per-kind code). Gates on the
  same approval policy as other writes. 87/87 mantis tests (6 new mutation
  tests); REST smoke + real-model agent trial recorded in SELFUSE.md R20; the trial's top friction fix shipped same round: /api/workspace now also carries the full capability surface (capabilities[]), so update/delete/read/enable are discoverable without guessing.
- R1 (done): capability manifest as single source of the tool surface;
  supply / ops / catalog descriptions derived from it; digest + visibility
  regression fixed (200 tests green).
- R2 (done): workspace resources DECLARED (apps/mantis/src/workspace.ts);
  append ops, recall kind filter and read outputs GENERATE from the
  declarations; third resource "task" proves adding a resource = one
  declaration, zero hand-written op code (fake-resource test). 208 green.
- R3 (done): automatic human UI derived from the declarations - Workspace tab
  on the web console renders every resource (label / write capability / records)
  plus a quick-add form GENERICALLY from /api/workspace (mantis_workspace MCP
  tool); zero per-resource UI code. Verified in a real browser (add + refresh).
  209 tests green.
- R4 (done): durable SHARED workspace - the host owns ONE append-only JSONL
  NotesStore (workspaceFile / MANTIS_WORKSPACE_FILE; default <uiDir>/workspace.jsonl),
  injected into every conversation: human UI writes, any agent session, restarts.
  Verified: restart keeps records; a fresh agent conversation recalls human-written
  tasks. 213 tests green.
- R5 (done): layered acceptance matrix (docs/acceptance.md) with per-row
  evidence; release smoke: real model catalog -> enable -> A2UI form render ->
  button click -> [ui.action] -> task_write lands in the shared workspace.
- R29 (done): MCP stdio external-agent contract pinned as an in-repo test
  (clean stdout JSON-RPC, full mantis_* surface, state round-trip w/o model);
  aligned Schema plain-text semantics to the author's fail-once contract;
  suite 254 green. Live demos still await the user's BAIZHI_API_KEY.
- R28 (done): loop-split refactor (loop/* modules) integrated - fixed
  finalToolFor asTool default, Schema re-ask budget, driver type; suite 253 green;
  + workspace update/remove & ui-version contract tests. Live demos still await
  the user's BAIZHI_API_KEY.
- R27 (done): restart trust automated (fresh console over the same dirs
  remembers turns saw:2 + workspace file); visual review PNGs captured for the
  user; suite 251 green.
- R26 (done): approval loop automated under a scripted model
  (approvals-flow.test.ts - approve lands the agent record, deny drops it);
  suite 250 green. Live model still needs the user's BAIZHI_API_KEY.
- R25 (done): MCP stdio hygiene (logs off stdout) + console.ts tail rebuilt
  after out-of-band truncation (covered by new scripted console-flow tests);
  loop.ts structured-output fixes; external-agent stdio e2e verified at the
  protocol level (14 mantis_* tools). Live-model runs paused: gateway now
  requires BAIZHI_API_KEY (401) - needs the user's key.
- R24 (done): approval loop e2e on an isolated gated console - protected write
  parks a card (tool+session), 同意 resumes + archives record, 拒绝 holds the
  write; same-conversation double-send now rejected by an in-flight guard.
- R23 (done): parallel work lines proven live - concurrency attribution race
  fixed (AsyncLocalStorage per-run in the web console); two conversations ran
  simultaneously into the shared workspace (43% wall saving, interleaved
  durable writes, zero timeline cross-talk).
- R22 (done, canvas v1 + user correction): product pivot to "digital worker"
  framing (delegate work; faster, parallel); clay skin removed; restrained
  professional dark UI; IA收敛 3+1 (会话/工作区/审批 + status); copy zh.
- R21 (superseded, user brief): Claymorphism visual language over the same logic -
  macaron palette, huge radii, double shadow + inner bevel, pressed-squash
  buttons, carved inputs, pills; A2UI surfaces remapped; light scheme forced.
- R20 (done): record mutations as declarative capabilities (update_record /
  delete_record over a generic record id; durable store replays mutation
  op-lines across restarts) - mutation.test.ts.
- R19 (done): responsive UI - mobile/touch gets a bottom nav + horizontal
  conversation strip, desktop keeps top tabs + left rail, all layouts survive
  any ratio with zero page overflow (browser-verified at 7 viewport sizes);
  uses 100dvh + safe-area + 16px touch inputs.
- R18 (done): code-level rename clawyp -> mantis (dirs, identifiers, env with
  CLAWYP_ legacy fallback, MCP tool names, pm2 names).
- R17 (done, per user decision): perry route DROPPED (artifacts removed,
  history marked). Workspace provenance filter shipped: All / Operator (ui) /
  Agent chips on the human tab, browser-verified filtering of ui vs agent
  records in the shared store.
- R16 (done): docs/agents.md - external agents get a verified onboarding doc
  (routes, tool surface, provenance, approvals etiquette, async chat flow).
- R15 (done): real-model restart proof - agent enables note_read, process
  restarts, the same conversation reports it VISIBLE without re-enabling.
- R14 (done): approval cards expose the asking conversation - /api/state and
  the Approvals tab now show which conversation requested each protected call
  (operator trust: who wants this write).
- R13 (done): full conversation state across restarts - enabled extended
  tools now persist with the turns (append-only meta lines), and a restarted
  host re-enables each conversation's surface before its next turn.
- R12 (user-directed, web runtime deep-dive, DROPPED R17): headless evidence
  that perry web runs sync UI/timers/console but await is non-suspending and
  promise completion does not pump (plus non-live State), so dynamic network
  UI is not reachable on the 0.5.1220 prebuilt; native fetch blocked at link.
  Per user decision the perry UI route is abandoned - all artifacts removed.
- R11 (user-directed, spike done; perry DROPPED R17): the perry UI toolchain
  spike (native/web compile, web route) was superseded by the R17 decision -
  dynamic data UI is blocked in the prebuilt, so the perry route is abandoned
  and all its artifacts removed from the repo.
- R10 (done): deployability - /api/health liveness probe (tested, live) +
  docs/ops.md runbook (envs verified against mains, data layout, approval gate,
  API table, single-writer rule).
- R9 (done): regression acceptance re-run on the live build (protected gate +
  A2UI button flow + provenance); agent-use fix: form [ui.action] values now
  explicitly mean "operator decided - act" (copy + persona) after a live
  discovery where the model waited instead of writing.
- R8 (done): provenance is model-visible - recall/note_read/append outputs
  carry source ("agent" | "ui"); recall gains an optional source filter; single
  source copy documents it.
- R7 (done): durable conversation memory - ConversationStore gains an
  append-only JSONL (memoryDir / MANTIS_MEMORY_DIR, default <uiDir>/memory);
  after a restart conversations still list, timelines rebuild from memory, and
  each session agent's history binding restores its prior turns (no more
  "who are you" after a deploy).
- R6 (done): product truth + provenance: op/persona copy now says "shared
  durable workspace" (not "this session"); every workspace record carries a
  source (agent vs ui) - persisted, reloaded, shown in the human UI, and
  single-sourced from the capability copy.
