# board · operation set

> The exact contract: every tool, the route it is also served on, and the rules that decide
> the answer. Design and rationale: `docs/board.md`. Contract summary:
> `apps/board/README.md`. Product-level introduction: `docs/board-white-paper.md`.
>
> Replaces `board-v2-mcp.md` (2024-09). The role matrix that file defined — operator /
> coordinator / agent / probe, with a per-tool permission table — is gone. Board declares an
> `access` level per operation and leaves *who may call it* to effect-planes and the MCP
> gateway (`docs/mcp-gateway-surface.md`): one place decides projection, policy and audit.
> Board has no second permission system, and no tool is MCP-only or HTTP-only — every route
> below comes from the same declaration as its tool.

## 1. Who calls board

| Caller | How it arrives | What it does |
|---|---|---|
| agent instance (any MCP client) | `board_sync` hello, then tools over stdio or through the gateway | claims a node, reports progress, reports the outcome |
| machine probe | MCP, on behalf of the agents it started (`channel: "probe"`) | the same run tools; the launch itself is agentd's |
| in-process runtime | `channel: "runtime"` | an effect child agent reporting through the same run tools |
| operator | the console UI, or the same tools over HTTP | plans the tree, edits documents, reads runs and agents |

`board_sync` is the hello: one round trip announces the instance **and** returns the board
just joined (`agent`, `agents`, `roots`) — an arriving agent does not have to ask twice.

## 2. Tasks

| Tool | Route | Access | Notes |
|---|---|---|---|
| `board_health` | `GET /api/health` | read | liveness |
| `board_state` | `GET /api/state` | read | tasks with `state` **and** derived `rollup`, plus counts by rollup state |
| `board_tree` | `GET /api/tree` | read | the forest, each node annotated with its rollup |
| `board_get` | `GET /api/tasks/:id` | read | one task |
| `board_create` | `POST /api/tasks` → 201 | write | defaults are applied here (create schema) |
| `board_update` | `PATCH /api/tasks/:id` | write | the patch **is** the body; omit a field to keep it, send `null` to clear it |
| `board_delete` | `DELETE /api/tasks/:id` | write | refused while children or dependents exist |

## 3. Runs

| Tool | Route | Notes |
|---|---|---|
| `board_sync` | `POST /api/sync` | announce + receive the board in one round trip |
| `board_agents` | `GET /api/agents` | announced instances with derived `presence` |
| `board_runs` | `GET /api/runs` | every run, or one node's (`nodeId`) |
| `board_run_start` | `POST /api/runs` → 201 | takes a node and holds it; 409 if a run already holds it |
| `board_run_progress` | `POST /api/runs/:runId/progress` | the runId is in the path, so progress cannot be reported against another run |
| `board_run_finish` | `POST /api/runs/:runId/finish` | `done` → node `done`; `failed` → node `blocked`, with the summary kept on the run |

A run's `channel` (`mcp-self` / `probe` / `runtime`) and `kind` (open string) come from the
announcement, not from a board enum. `sessionRef` and `intentId` are optional references to
the agent's own session and to agentd's launch intent.

## 4. Projections

| Tool | Route | Notes |
|---|---|---|
| `board_table` | `GET /api/table?columns=…` | rows over the same tasks; `agent` = who holds the node now |
| `board_events` | `GET /api/events?after=N` · `?tail=N` | cursor replay, at most 200 events per call; `tail` reads the newest N instead |
| `board_calendar` | `GET /api/calendar.ics` | `text/calendar`; only tasks with a due time appear |

Table columns: `id`, `title`, `body`, `state`, `rollup`, `depth`, `parentId`, `parentTitle`,
`dependsOn`, `waits`, `failure`, `startAt`, `dueAt`, `agent`, `kind`, `channel`, `sessionRef`,
`heldSince`.
Unknown names are refused. Rows come back in tree order — every parent before its children — and
`depth` is how far a row sits below its root, so a table reads as the tree without a second
traversal.

Three columns resolve what the task stores as a reference, because a row is read on its own:
`parentTitle` is the parent's title, `waits` names the dependencies that are not finished (the
derived state decides "finished", not the parent's own), and `failure` carries the last run's
summary for a blocked node. The raw `parentId` and `dependsOn` stay for a caller that wants them.

## 5. Documents

| Tool | Route | Notes |
|---|---|---|
| `board_doc_list` | `GET /api/documents` | summaries (`docId`, `title`, `version`, `updatedAt`) |
| `board_doc_get` | `GET /api/documents/:id` | the whole outline |
| `board_doc_create` | `POST /api/documents` → 201 | |
| `board_doc_apply` | `POST /api/documents/:id` | one op + the version it was read at; stale → 409 |
| `board_doc_delete` | `DELETE /api/documents/:id` | |

Outline operations: `retitle`, `insert`, `update`, `toggle`, `move`, `remove`. Each applied
operation advances the document version, whichever collaborator sent it.

## 6. Answers and refusals

A tool answers its payload directly (`{ tasks, counts }`, `{ roots }`, `{ runId, … }`); a
failure carries a status. The statuses board actually returns:

| Status | When |
|---|---|
| 400 | schema or data rule: unknown field, cyclic parent or dependency, dangling reference, duplicate dependency, `dueAt` before `startAt`, unknown table column, over-limit text |
| 404 | task, run or document does not exist |
| 409 | a state conflict: another run holds the node; the caller does not hold the run; the run already ended; a node with children is asked to take a state other than `cancelled`; a reference blocks deletion; a stale document version; an incompatible store under `refuse` |

## 7. Lifecycle in one line

`board_sync` (hello) → `board_run_start` (claim — a 409 rather than a second owner) →
`board_run_progress`* → `board_run_finish` (`done` → node `done`; `failed` → node `blocked`).
A restart with no report turns the run into `orphan`: board's own finding, never anyone's
claim.
