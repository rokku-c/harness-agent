# Board

The task board. It is reached at `/board/` through declarative SDK routes and opens no listener of
its own; the standalone hosts below are for running it on its own.

Design and rationale: `docs/board.md`. The exact tool and route contract: `docs/board-tools.md`.
The product-level introduction: `docs/board-white-paper.md`. Diagrams: `docs/board-architecture.md`.

## What it owns

Board owns board and task data, and nothing else. It does **not** own agent scheduling, resource
governors, Claude configuration, machine registration, launches, or consent — those belong to the
agentd center and to the platform. Board never starts an agent, and a task's state is task data an
operator wrote, not a background agent's lifecycle.

## Tasks

- Create, read, update, delete, and move; parent/child hierarchy and relations.
- A relation must point at a task that exists, and relations may not form a cycle; children and
  relations are detached before a delete.
- A parent's `state` is what an operator set, and its `rollup` is what its children make it — the
  two are reported separately rather than reconciled behind the operator's back.
- Every change and its event commit in one transaction. Each read sees current SQLite data; the
  board is not an in-memory snapshot written over the file.
- An existing database is never migrated and never deleted. A store this build cannot read is
  **moved aside** — `<dataFile>.incompatible-<stamp>`, with SQLite's `-wal`/`-shm` siblings — and a
  fresh one is created, so the board starts and the operator keeps every byte that was there.
  `incompatibleStore: "refuse"` in the app config turns that into a 409 instead, leaving the file
  untouched, for a board whose tasks are real.
  **Scope and removal condition:** cleaning by default is an explicit exception granted for the
  current development stage, where these files hold test data and a board that will not start costs
  more than a store nobody has read. Before this product runs anywhere with tasks worth keeping,
  the default flips to `refuse` and `clean` becomes the operator's explicit choice.

## Runs

A run is one execution binding: an agent instance *holds* a task node while it works, and board
records the binding.

- `board_run_start` refuses if another run already holds the node, so one task is never worked twice
  at once. Progress and finish may only be reported by the agent holding the run.
- `channel` says how the agent reached the board: `mcp-self` (claimed over MCP), `probe` (reported by
  a machine's probe), or `runtime` (the in-process runtime).
- `sessionRef` names the agent's own session, and `intentId` ties the run to the agentd launch intent
  that produced it, so a launched agent and a self-announced one land in the same record.
- `kind` is an open string, not a board enum: which agents exist is agentd's vocabulary, and board
  must not need a release to learn a new one.
- After a restart, a run nobody reported on is board's own finding — `orphan` — and never an agent's
  claim.

## Tables

`board_table` (and `/api/table`) lays the same tasks out as rows instead of a tree, including the
column that earns a table its place: **who holds which node right now**. It is a projection and not
a second store — every cell is a field the task has or a value the tree already derives — and
`columns` selects what to show, not what is read. An unknown column name is refused rather than
dropped. The console's table view and the standalone web view both mean the same thing by "Held by":
the run holding the node right now, since a node has at most one such run.

## Documents

Outline documents, for work that is a structure rather than a list: create, read, list, and apply one
outline operation at a time. Every apply carries the version it was read at, and a stale version is
refused instead of overwriting a change that landed in between.

## Calendar

`/api/calendar.ics` serves the tasks as an RFC 5545 feed — `text/calendar`, folded lines, a
`CALSCALE` and `METHOD:PUBLISH` header, and one `VEVENT` per task that has a due time. Untimed tasks
are left out rather than given an invented time. The feed subscribes into Apple Calendar like any
other.

## Surfaces

Every board operation is declared once, in `tasks/ops.ts`, `runs/ops.ts` and `docs/ops.ts`, with an
`operation({ name, description, access, input, handler, http })`. The same declaration becomes an
MCP tool (`toEffectTools`) and an HTTP route (`toHttpHandler`), so the two surfaces cannot drift and
a new capability is one entry rather than a tool plus a route plus the wiring between them.

MCP tools: `board_state`, `board_get`, `board_create`, `board_update`, `board_delete`, `board_tree`,
`board_table`, `board_events`, `board_sync`, `board_agents`, `board_runs`, `board_run_start`,
`board_run_progress`, `board_run_finish`, `board_doc_list`, `board_doc_get`, `board_doc_create`,
`board_doc_apply`, `board_doc_delete`, `board_calendar`, `board_health`.

HTTP follows the same declarations: `/api/state`, `tree`, `tasks`, `tasks/<id>`, `table`, `agents`,
`runs`, `runs/<runId>/progress`, `runs/<runId>/finish`, `events`, `sync`, `documents`,
`documents/<id>`, `calendar.ics` and `health`. Anything else under `/api/` is a 404 with
`{"ok":false}` rather than an HTML page.

## Running it standalone

- Web: `bun apps/board/src/hosts/web/main.ts` (`BOARD_PORT`, `BOARD_DATA_FILE`)
- stdio MCP: `bun apps/board/src/hosts/mcp/main.ts` (`BOARD_DATA_FILE`)
