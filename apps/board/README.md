# app-board

A gitlab-workitem-style board for coordinating many agents over shared
resources. It is an independent app that depends only on effect-agent's
bottom abstractions (@effect-agent/core, @effect-agent/builtin,
@effect-agent/model) plus effect and the MCP SDK - nothing inside clawyp or
any specific host is imported.

## Why a board

Once several agents share one workspace, "just do the work" stops scaling:
you need to know what is planned, what each agent is doing, who holds the
only GPU, which item waits on which, and how to resume after a restart. The
board answers that with a resource-governed work queue: items move through a
state machine, and an item may not start unless its dependencies are done
and its whole resource claim group is granted atomically.

## Layers

  1. domain       domain.ts      WorkItem (state machine), Resource, Executor,
                                 ViewColumn / BoardView, transitions (pure)
  2. store        store.ts       Ref-backed tables + optional JSON snapshot
     governor     governor.ts    resource claims: exclusive = one holder;
                                 shared = up to capacity; ALL-or-nothing
                                 groups; parked waiters woken by priority
                                 then FIFO (Deferred-based, no polling)
     service      board.ts       BoardApi - the workflow rules on top:
                                 create / start / report done|failed /
                                 cancel / block / unblock / register and
                                 heartbeat executors
  3. coordinator  coordinator.ts the builtin agent: reads the board, breaks
                                 a goal into subtasks (children of the goal)
  4. MCP          hosts/mcp      board_* tools over stdio (or in-process) -
                                 the ONLY surface external agents talk to
  5. web          hosts/web      a browser panel; the page is an MCP client,
                                 every /api call maps onto the board MCP
                                 server (same board_* tools as Claude Code)

State machine (enforced by canTransition):

    todo -> ready -> doing -> done
             ^   \      \----> failed
             |   \------> blocked (waiting: dependency | resource | human)
             \------> cancelled

Resource semantics:

- an item declares `requires` claims (resource id + optional amount);
- exclusive resources allow exactly one holder (the whole resource);
- shared resources allow many holders up to capacity;
- claims commit atomically - a group never grabs a partial slice;
- when a group does not fit, the item parks as blocked (waiting for
  resources); the next release re-evaluates parked items (priority, then
  FIFO) and grants whoever fits, flipping it to doing automatically;
- no preemption in v1: once granted, an item keeps its resources until it
  reports, fails, blocks, or is cancelled (all of which release + wake).

## Executors and multi-agent access

- builtin executor: the coordinator agent (registered when a model is
  configured) - ask it to break a goal into board items via
  board_coordinate (or /api/coordinate on the web panel).
- external executors reach the board only through MCP: board_register_executor,
  board_heartbeat, board_start, board_report_done|failed, board_cancel,
  board_block, ... (Claude Code, a script, any MCP client).

## Running

One command runs everything - the web panel AND the stdio MCP surface in a
single process over one shared board. (The panel is a browser-side MCP
client, so there is no separate frontend/backend process to wire up.)

    BOARD_WEB_PORT=3999 BOARD_DATA_FILE=/tmp/board.json \
      bun apps/board/src/hosts/all/main.ts        # or: bun --cwd apps/board start

Open the printed url (default http://127.0.0.1:3999). Items created over
stdio (Claude Code, any MCP client) appear in the panel immediately, and
vice versa - one process, one live board, one writer of the snapshot file.

Split entries, when you only need one surface:

    BOARD_DATA_FILE=/tmp/board.json \
      bun apps/board/src/hosts/mcp/main.ts          # stdio MCP only

    BOARD_WEB_PORT=3999 BOARD_DATA_FILE=/tmp/board.json \
      bun apps/board/src/hosts/web/main.ts          # web panel only

Without BOARD_MODEL_* the builtin coordinator is disabled - the board still
fully governs external executors. Set BOARD_MODEL_API / BOARD_MODEL /
BOARD_MODEL_KEY / BOARD_MODEL_BASE (openai.chat or anthropic.messages) to
enable board_coordinate.

The web panel is React 19 + Mantine (light theme, thin dividers). It is
built into apps/board/src/hosts/web/public by:

    bun --cwd apps/board build:web     # regenerate /app.js + /app.css

The built assets are committed, so one-command start works without a build
step; rebuild only after editing apps/board/src/hosts/web/panel/*.

Persistence: with BOARD_DATA_FILE every mutation writes a full JSON
snapshot, so a restart resumes items, resources and executors.

## Tests

    bun test apps/board/test/    # 22 tests: model, governor, workflow,
                                 # persistence, coordinator, MCP end-to-end
