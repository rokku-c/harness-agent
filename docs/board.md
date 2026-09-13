# board · design

> Status: design v1 (2026-09-11). Replaces `board-v2.md` (2024-09), whose launch
> control, probe command queue, consent and merge chapters describe work that now
> belongs to agentd, agentdeck and deckconsole — and that board is forbidden to grow
> back (`AGENTS.md`, "Separate app, network, and access governance").
>
> Contract summary: `apps/board/README.md`. Exact tool and route surface:
> `docs/board-tools.md`. Product-level introduction: `docs/board-white-paper.md`.
> Diagrams (architecture and sequences): `docs/board-architecture.md`.
> Platform context: `docs/builtin-apps.md` (the portfolio),
> `docs/architecture-rework.md` (kernel, artifacts, container nodes),
> `docs/mcp-gateway-surface.md` (the one agent-facing door).

## 1. What board is

One host (`effect-server`) mounts a set of declarative apps, and board is the one that owns
the platform's durable work graph (`docs/builtin-apps.md` §5). The invariant it exists to
protect: **humans and agents must not each invent task, dependency, status or history
semantics.** Every agent that works a task and every operator who plans one read the same
tree, and neither can be talked into a second version of the truth.

Board's promise in one sentence: *an agent may declare what it is doing; board decides
whether that declaration is consistent with what it has already recorded.*

Two consequences run through the whole design:

- **Board records, it does not schedule.** A run is a binding an agent asks for and board
  grants or refuses. Board never wakes a machine, never launches a process, never holds a
  queue of intents.
- **Board derives, it does not store twice.** A parent's state is a function of the leaves
  below it; presence is a function of a timestamp; a table is a projection over the same
  rows. Where a second copy could disagree with the first, there is no second copy.

## 2. What board refuses to own

| Not board's | Owner | Why the line is here |
|---|---|---|
| Launching an agent, machine access, launch intents | **agentd** (+ the node probe) | Which agents exist on which machine is agentd's vocabulary; board must not need a release to learn a new kind |
| Who may call a tool | **Access** (MCP gateway) + effect-planes | One place decides projection, policy and audit; board declares an access level, it does not adjudicate identity |
| Which model a run used | **Models** (ai-gateway) | Provider routing, credentials and usage are not task data |
| Approval before a protected action | **Agents** (deckconsole / agentdeck) | The consent ledger belongs to the thing running the session; board would be a second ledger |
| Runtime sessions, transcripts, interrupts | **Agents** | A run carries `sessionRef`; the session itself lives elsewhere |

Board's entire footprint on that axis is one record: a run keeps the agent id, the channel
it arrived through, the agent's own session reference, and agentd's `intentId` when a
launched machine reported it. That is a **reference to someone else's decision, not a copy
of it** — which is why board never has to be restarted when that decision changes.

## 3. How board is built on the platform

**One declaration, three surfaces.** Every capability is written once in `tasks/ops.ts`,
`runs/ops.ts` and `docs/ops.ts`, as `operation({ name, description, access, input, handler,
http })`; `api.ts` collects the list, `toEffectTools` turns it into MCP tools and
`toHttpHandler` into HTTP routes. An agent calling `board_create` and a browser POSTing to
`/api/tasks` are therefore validated by the same schema and executed by the same handler —
they cannot drift, and a new capability is one entry rather than a tool plus a route plus
the wiring between them. `access` defaults to `write` (`packages/effect-interface/src/surface/operation.ts:85`),
so reads say so and writes stay silent.

**What board declares.** An `interface` (its tools), a `ui` view (`effect-ui.ts`, the console
surface), and a `config` schema (`effect-config.ts`: `dataFile`, `incompatibleStore`). Its
durable data is its own SQLite file, named by that config — not another app's storage.

**Artifact form.** Board is the only built-in app that ships an `effect.bundle.json`
(`io.effect-agent.board@1.0.0`, `abi: effect-1`, `runtimes: ["os"]`, `namespace: ops`), and
`src/effect-bundle-entry.ts` is the only app-supplied bundle entry in the tree — every other
app is mounted through the host's in-process manifest loader
(`docs/architecture-rework.md` §7.6). That makes board the reference implementation — and
the canary — for the artifact lifecycle: staging, activation, rollback, the ABI gate and
kernel hot-swap. Two obligations come with the position:

- **The handle is not re-opened across a kernel swap.** A second opener of the same SQLite
  file is a second writer; the store must be handed over, not re-created.
- **No ambient IO in the app.** Board is on the ambient-debt list
  (`docs/app-portability-inventory.md`: `bun:sqlite`, `node:fs`, `node:path`), so its
  "the same artifact runs anywhere" claim is *declared* (`runtimes: ["os"]`) but not yet
  earned. The fix is to inject the store as a capability.

**Port-free.** The app is a request handler (`hosts/web/server.ts`). The standalone hosts
(`hosts/web/main.ts`, `hosts/mcp/main.ts`) exist so board can be run on its own; they open a
listener explicitly and are not platform listeners.

## 4. The task model

**Tree.** A task has a `parentId` (absent = root), ordered `dependsOn`, title, body, state,
and optional `startAt`/`dueAt`. Relations are **data constraints, not a scheduler**
(`tasks/relations.ts`): every referenced task must exist, duplicate dependencies are
refused, and neither the parent chain nor the dependency chain may contain a cycle. Nothing
re-orders, nothing wakes.

**Derived state.** Non-leaf state is a pure function of the leaves below it
(`tasks/rollup.ts`), so "parent done, child still running" cannot exist. `board_state`
reports the two **separately** — `state` is what an operator set, `rollup` is what the
children make it — rather than reconciling them behind the operator's back. The same pass
yields `kind` (goal / group / leaf, derived from the shape, never stored), `progress`, leaf
counts, `running`, and `interrupted` (a run below stopped without reporting: a human's
problem).

**Writes stay honest.** Because a parent has no state of its own, `board_update` refuses any
state but `cancelled` on a node that has children — and cancelling cascades to every
descendant, so no leaf is left running under a cancelled parent. Deletion requires neither
children nor dependents; references are detached first.

**Patch semantics.** `board_update` takes a patch where an omitted field keeps its value and
an explicit `null` clears it. The patch schema deliberately carries **no defaults**: a
default would make an omitted field parse as that default, so touching one field would erase
every field the caller did not mention. Creation applies the defaults instead.

## 5. The run model

A run is one execution binding: an agent instance holds a node while it works, and board
records the binding. Three rules do the work:

1. **A node has at most one running run.** A second `board_run_start` is refused with 409 and
   told who holds it, so two agents can never both believe they own a task.
2. **Only the holder may report.** progress and finish check `runId` + `agentId`; a run that
   already ended refuses a second terminal report.
3. **Board schedules nothing.** The agent starts the run; board records the claim.

`kind` is an **open string, not an enum** — which agents exist is agentd's vocabulary.
`channel` records how the agent reached board: `mcp-self` (claimed over MCP), `probe`
(reported by a machine's probe on behalf of the agent it started), `runtime` (the in-process
runtime). `sessionRef` names the agent's own session, and `intentId` ties the run to the
agentd launch intent that produced it, so a launched agent and a self-announced one land in
the same record.

**A restart tells the truth about itself.** Every run still marked running when board starts
has no live agent behind it, so board marks it `orphan` — and invents no `endedAt`, because
it knows the run stopped being held, not when. `orphan` is board's own finding and can never
be an agent's claim. The most recent run decides whether a node is still `interrupted`: an
orphan stays flagged until something runs again.

**Failure does not invent a state.** A failed run sets the node to `blocked` (it needs
attention) and keeps the truth — "failed, with this summary" — on the run record. Board does
not add a `failed` state to its task machine to hold someone else's vocabulary.

**Presence is derived.** An agent instance is an identity plus a `lastSeen`; `online` is
computed from that timestamp, never stored, because a stored flag goes stale the moment an
agent dies and board would then report a dead agent as connected. A heartbeat is not an
event: recording each one would turn the event ring into a presence log nobody reads.

## 6. Collaboration surfaces

- **Table** (`board_table`, `/api/table`) — the same tasks as rows. A projection and not a
  second store: every cell is either a field the task has or a value the tree already
  derives. The column that earns it its place is `agent` — who holds this node *right now*
  (a node has at most one such run). `columns` selects what to show, not what is read, and an
  unknown column is refused rather than silently dropped.
- **Documents** (`board_doc_*`) — outline documents, for work that is a structure rather
  than a list. The API takes **one operation at a time against the version it was read at**,
  because two collaborators editing different parts of one outline is the normal case and a
  whole-document write is what makes that lose work. A stale version is refused (409) and the
  editor is told to refetch.
- **Calendar** (`board_calendar`, `/api/calendar.ics`) — an RFC 5545 feed of the tasks that
  have a due time. Untimed tasks are left out rather than given an invented time; the feed
  subscribes into Apple Calendar like any other.
- **Events** (`board_events`) — ordered, cursor-replayable history. High-frequency
  `run.progress` is coalesced to one event per run per second, so a chatty agent cannot flush
  the ring. Every mutation and the event it emits **commit in the same transaction**.

## 7. Storage and lifecycle

One SQLite file, single writer, named by the app config (`dataFile`, default
`.effect-agent/board.sqlite`). Reads see current rows rather than an in-memory snapshot
written over the file, so two board instances over one file see the same tasks.

A store this build cannot read is **never migrated**: it carries a schema version and a table
fingerprint, and a mismatch means the file is **moved aside**
(`<dataFile>.incompatible-<stamp>`, with SQLite's `-wal`/`-shm` siblings) and a fresh store is
created — or, with `incompatibleStore: "refuse"`, the board refuses to start with a 409 and
leaves every byte alone.

**Scope and removal condition:** cleaning by default is an explicit exception granted for the
current development stage, where these files hold test data and a board that will not start
costs more than a store nobody has read. Before this product runs anywhere with tasks worth
keeping, the default flips to `refuse` and `clean` becomes the operator's explicit choice.

## 8. What "complete" means now

`docs/builtin-apps.md` §5 says board is complete "when a user can plan a tree, run an agent
against a leaf, observe progress, resolve a blocker, and inspect history without leaving
Board". Board's half is the half it owns — plan, observe, resolve, inspect. The rest now
crosses apps by design, and board must not grow it back:

| Step | App that serves it |
|---|---|
| plan a tree, inspect history | board |
| run an agent against a leaf | agentd (launch intent) → probe → the agent calls `board_run_start` |
| see that the run is live | board (`board_runs`, the table's `agent` column); session detail in **Agents** |
| resolve a blocker | board (state, dependencies), with the agent's failure summary on the run |
| see it in the cross-app feed | **Activity** (system app) |

Two gaps follow from that table, and both are open:

1. **The loop has no owner.** Nothing today takes a ready, assigned leaf and produces a
   launch intent. agentd can launch an agent and an agent can claim a run, but no component
   connects "this leaf is ready and assigned here" to "launch it there". That is a scheduling
   workflow, and by `AGENTS.md` and `docs/builtin-apps.md` it does **not** belong inside
   board — which means the gap is closed by a workflow over the two apps, not by a new board
   capability.
2. **Dependency completion wakes nothing.** `dependsOn` is validated and reported, but
   nothing re-evaluates a blocked node when its dependency finishes: a waiting leaf becomes
   claimable only when an operator or an agent looks. A re-evaluator that recomputes waiting
   nodes after any terminal state change is still unbuilt — and it is a pure function over
   board's own data, so it is board's to build.

Open at the platform level rather than the feature level: board is on the ambient-IO debt
list, so its portability is declared but not earned (§3).

## 9. Refused designs

Kept as decisions, so they are not re-litigated by a later reader:

- **Board as launch console** (the 2024-09 design's P3) — removed. Launch lives in agentd,
  approval in Agents; board keeps references only.
- **Board as probe command channel** (`board_poll` / `board_exec_ack`) — removed. The node
  probe pulls from agentd.
- **Board as resource governor** (claims, park/wake, priority-FIFO) — removed. Board has no
  scheduler: a node is held by a run or it is not.
- **Parent nodes as a second execution unit** — removed. Only leaves are held; a parent's
  state is derived and its cancellation cascades.
- **Kanban as the default surface** (`board-ia.md`) — a row-per-task worktable answers
  dispatch / watch-for-blockers / watch-for-failures better than columns of cards, and the
  primary view is the tree.
