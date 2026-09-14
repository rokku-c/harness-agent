# board · product information architecture decision (control-room worktable)

> A 2024-09 decision record. Why the main view of the multi-agent worktable is not a classic Kanban.

## Problem

The original main view was a classic Kanban (cards in todo→done columns). Real usage data (67 work
items, 5 executors, exclusive-resource mutual exclusion, dependency/blocking chains, long results,
event streams) exposed structural defects:

1. **Low information density**: a card carries only a title + two pills; "who is working on it / where it
   is stuck / what it waits on / what resources it holds / how long has it been / why it failed" all
   require opening a modal one by one, and columns cannot be compared.
2. **7 columns of large trays sit largely empty under real load**, effective screen utilisation <30%.
3. **Layout decoupled from the interaction protocol**: the panel has no drag, every change goes through
   the `act()` MCP tool (the same protocol as Claude Code) — Kanban's only mental value, "dragging a
   card", is unusable, and the column layout is left with pure display overhead.

## Product judgement

The real task of a human-machine shared worktable is not "moving cards", but four things:
**assign work → watch blockers → arrange resources → chase failures**.
So the default surface should be a **scheduling console**, not a wall metaphor.

## Design

- **Default view Worktable (main table)**: rows = work items; columns = state group / assignee /
  waiting dependency / resource occupancy / age (createdAt/updatedAt); the second line under the title
  directly surfaces labels, blocking reason and failed-result summary — key signals reached without a click.
- **Top-bar filter chips**: filter by state group (with counts) / assignee + full-text search;
  sort = state group order → priority → most recently updated.
- **Inline primary actions**: Start / Mark done / Block / Unblock (same source as the detail modal
  actions, the same `act()` protocol), touch friendly.
- **Kanban kept as an optional view** (top-bar Table ⇄ Board toggle), the desktop drag mental model
  still exists, but it is no longer the default.
- Clicking a row opens the original detail modal (body / deps tree / actions), with no duplicated information.
- ≤960px: the main table automatically degrades to streaming info cards (each row expands all fields vertically), with no horizontal scrolling.

## Verification and follow-up

- Code: `Worktable.tsx` (data 100% from the existing `/api/state` protocol, no new backend surface),
  `style.css` gains a wt-* style layer (reusing Clay skin tokens).
- Regression: board 34/34 tests green; the bundle contains the new component; the desktop Clay baseline is untouched.
- Runtime verification (Puppeteer + system Chrome 152, 2024-09): 67 rows of real data rendered;
  the State/Assignee/Waits/Holds/Age headers in place; group chip counts match the Kanban column
  counts column by column (Todo 1 / Doing 0 / Blocked 1 / Done 55 / Cancelled 10,
  membership taken from the server's `col.itemIds`, not derived a second time); clicking a row opens the
  detail modal (title/state consistent); Table⇄Board switching works both ways (Board 5 columns, 67
  cards); 390px touch: no horizontal overflow, streaming row layout, headers hidden; zero JS exceptions throughout.
- To do: when the unified information protocol with the mantis console (a same-layer state protocol for
  people and agents) is chartered, use this table as the field-set reference.

## Amendment — what the default drawing is, and what "Worktable" turned out to mean (2026-09)

This record is kept for its argument, not as a description of the current client, and one sentence
in it now reads against the code. It said **"Default view Worktable (main table)"**; the client
opens on **Tree**. Leaving both standing would leave the next reader two records that disagree, so
the judgement is written down here.

**The decision is Tree as the default, and Table as the scanning drawing.** The reasoning is that
the paragraph above states what a row must carry — identity, state, the blocking reason, reached
without a click — and that is a requirement on **a row**, not a ranking of layouts. Every drawing in
the client now satisfies it: the blocking reason is a field on the task and is drawn wherever a row
is drawn. What is left to decide the default is the second axis this record did not have in view:
**rooting**. Tree is the only drawing that can be rooted at an arbitrary node and redrawn from
there, which is the whole of "the same graph seen from any node, including the subtree one agent
holds". A default that could not be rooted would make the product's second axis something you have
to go somewhere else to reach.

**The other correction is structural.** "Kanban kept as an optional view (top-bar Table ⇄ Board
toggle)" was right about the mechanism and wrong about the scope: the client now names **three
destinations** — Work (the plan), Runs (the record), Setup (this machine) — and the five layouts of
the task graph are **drawings inside Work**, chosen by a control rather than by leaving the place.
They were five destinations for a while, and it cost a node: because the model said "you have gone
somewhere else" about a change of layout, opening a node in the tree and then looking at the same
node on the board closed it. Measured, `open=t-5ec98498` was in the address before the press and
gone after it. A change of drawing is not a change of subject, and the address now says so.

The four real tasks this record named — assign work → watch blockers → arrange resources → chase
failures — are covered as: Work and the node's own panel for the first two, Runs for the fourth.
**Arranging resources is still deliberately not built**: the board shows who holds a node and
offers nothing for moving them, because scheduling belongs to the center and not to the graph.

## Verification toolchain memo

Local Chrome has been upgraded to 152: the CLI dump-dom of `--headless=new` fails intermittently,
and the DevTools WebSocket needs `--remote-allow-origins=*`. The stable path =
`puppeteer-core` (/tmp/pcap, npm official registry) + system Chrome
(headless:true, args including --remote-allow-origins), waitUntil networkidle2.
