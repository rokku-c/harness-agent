# The flows: who owns each step of each journey

> A design record. Three journeys live in this product — the operator's, the
> agent's, and an app's — and each one is a sequence of steps. This document
> names the surface that **owns** each step, and the rule that keeps the step
> from being offered by a second surface with a different meaning.
>
> The rules are not taste. Each answers a defect that was measured in the code
> and in the running console; the measurement is quoted with the rule.

## Why this document exists

A product whose surfaces each offer "some of everything" has no flows: a person
has to discover, per screen, which of the four controls that all look like
navigation is the one that goes where they meant. Apple's guidance puts it as
navigation being *hierarchical, flat, or content-driven* — pick one per
context — and modality being reserved for a task that must be finished or
abandoned. The console here is:

- **flat** on Home and Settings (a launcher: every app is one step away, in any
  order), and
- **hierarchical** inside an app (a screen is entered from a screen, and Back
  goes up exactly one level).

Everything below is that decision applied, plus the two rules that make a
hierarchy usable: **one control per destination**, and **a destination is
complete when you arrive** — however you arrived.

## The nine rules

| # | Rule | Why it is a rule, not a preference |
|---|---|---|
| F1 | **One control per destination.** A destination has exactly one control that reaches it, on exactly one surface. Another surface may link to it, never re-offer it. | ⌂ and ☰ were both live on every app screen, both going Home. A person reads two controls as two destinations. |
| F2 | **Up is one level, and it is always in the same place.** The leading control goes to the parent screen; at an app's first screen it goes Home. Never `history.back()` unconditionally. | `screen-bar` called `history.back()`, whose own comment conceded it can land on "the page the reader came from" — a pasted link has no history, so Back left the product. |
| F3 | **A destination is complete on arrival.** The address names the screen *and* what it shows; arriving cold builds the same screen with the same content as arriving by press. A screen that needs data declares how to load it — and a load its address does not name is not attempted. | `#view/board/task?taskId=…` rendered *"No task is open. Pick one from the board."* — the parameter was written to the URL by the press and read by nothing. Measured live. The same rule a second time: `#view/board/task` with no id sent `GET /board/api/tasks/` and answered "Unknown Board route" beside the empty sentence — a request about a path the declaration never described. |
| F4 | **An action's result appears where the press was.** A press names the reads its result changes, and a re-run read is a read and not a press — it makes its call and writes its own answer; it consumes no draft and enters no screen. What a press fills sits *after* it in reading order, where the eye already is. | deckconsole's `deck.send` wrote `/result/turn` and refreshed only the session list, while the transcript on the same page reads `/opened`, which only `deck.select` writes: send a turn and the answer never appeared. The product had two kinds of read — a source and a read-action — and only the first could be re-run. `refresh` now names either, and a press that made no call consumes nothing. Proven: `Formal/Refresh.lean`. The same rule a second time, in mantis: `mantis.send` fired the turn and answered "accepted", and the reply arrived on an event stream the console does not have, so the transcript under the button never showed it — the turn is now waited out, and the timeline is one of the reads the press re-runs. And the order: the conversation a row's `Read` fills used to be drawn *above* the rows that chose it, so a press changed what was behind the reader, past two empty cards that each said "press Read" — the doors now come before the room they open. |
| F5 | **One surface writes a fact.** Other surfaces read it or link to the writer. | Configuration is written on Settings *and* reachable as `#config/<app>`, which mounts nothing and answers with an error callout. Two doors, one of them painted on. The same shape at the list: a card showed a table's header row under the notice saying the list was empty — the notice said the true thing and the bare header said there were columns of nothing, on four cards of one page. A list is now drawn only while it has a first row (`whenRows`), from the same predicate the notice reads. The same defect a third time, on the gateway's own console: its audit card built its table by hand beside `sourceStates`, so the notice said no decisions had been recorded and a bare header under it said there were columns of nothing — measured in the browser, on the page an operator opens to find out what the gateway refused. And the same shape as a fact written twice: mantis's composer addressed a `message.conversationId` of its own while the timeline showed the read's answer, so a message could be typed beside a timeline it was not addressed to. The conversation the page is about is now the read's own answer — one path, written by the read, shown by the timeline, named by the composer and carried by its button. And a surface that *promises* a fact must carry it: the gateway's tool picker said "Topology names what each server answered" while Topology drew three lists that did not include it, and the operation's own description claimed the same thing — so the load report is now a column of the server row it is about (`listed`, `failed` with the sentence the upstream returned, or `not asked` for a server that is down), because an offline server appears in neither of the report's two lists and a column reading the report alone would leave the likeliest case unsaid. Measured live: with the upstream's endpoint pointed at a 404 the row read `healthy · failed · Streamable HTTP error: …`, and pointing it back read `healthy · listed`. |
| F6 | **One identity, checked at one door.** An agent is identified by a credential the door verifies; a header is a hint, not an identity. | `mcp-server.ts` accepted any `x-agent-id`; `authenticate` was never supplied, so `authInfo` was always undefined and any caller could assume another agent's sets. The door is now `door-auth.ts`, and it is handed the two stores rather than the whole resolving surface, so `trusted` and `claims` — the fields that let a *transport* vouch for what it passed through — cannot be set by an HTTP request; the headers of one are read as a single thing, the bearer token (`Formal/DoorAuth.lean`). Measured live on one running gateway, four callers at `POST /mcp-gateway`: a credential for `app:agent-1` was named and carried its call through; the same request carrying `x-agent-id: agent-1` and no credential was named nobody and refused `401 no credentials`; a forged bearer token, `401 invalid token`; a *valid* credential for an unbound `app:stranger`, named nobody and refused `404 no_server`. The header decides nothing in any of the four. |
| F7 | **One store per fact, and the surface that writes it shows it.** | The set an agent reaches the gateway through was declared twice — in the center that issues the identity a binding is keyed by, and again in the gateway's own config — with nothing between the two, so an operator who bound an agent over `agentd_bind` found the gateway page still answering *"No agents bound to a set yet."* The gateway's `sets`/`bindings` config fields are gone, not deprecated; the center is the one home, and what crosses to the door is a **reader over the center's own state** rather than a copy of it (`context.mcpSets`, the same shared-surface shape as `context.mcpRegistry`), so the door holds no second copy and there is nothing to keep in step. The seam refuses a second author — `provide` throws if an app other than the one holding the slot takes it, and a reload is the same app re-providing, which is allowed — and the door rebuilds on the center's **revision**, never on a clock, so there is no period in which it decides with a binding its operator has already replaced (`Formal/SetSource.lean`). The rebuild is total by construction rather than by try/catch: the duplicates the registry throws on are refused by the one mcpset grammar, which the center's config loader and its `agentd_upsert_mcpset` op both parse with, so a stored declaration is one the door cannot fail to build. The gateway's config schema refuses `sets`, `bindings` and `defaultAction` outright, and the end-to-end test declares the set and the binding on the center and the door serves them. |
| F8 | **What a door advertises is what it enforces.** | `tools/list` answered one multiplexed `mcp_gateway_call` while the page copy said "one governed MCP entry point for every agent" and the per-tool surface was unbuilt. The listing is now not a second rule that agrees with the call — it *is* the call, asked once per tool: `visibleEntries` offers every catalog entry to the gateway's own `decide` and keeps the ones it allowed, so a tool missing from `tools/list` is a tool `tools/call` refuses, and the call runs that same `decide` with the same arguments (`Formal/Authorize.lean`). Measured live on the four callers above: the caller who could carry a tool was shown four, and the one call that went through came back naming the server and the set that carried it; the three who could carry nothing were shown nothing, before any of them asked. |
| F9 | **One decision engine per verdict.** A preview must be the decision, not a copy of it. | `access-audit.ts` re-implemented `sets.ts` — the file's own comment said the copy existed "precisely because it can drift", and it is what the operator reads before granting. It now asks the gateway's own registry (`reach`, `resolve`, `bound`) and reads the answer, so the page's Allowed and the call's outcome are one value read twice rather than two computations that happen to match. The same rule a second time, at the config: the registry refused a binding to a set nobody declares by *throwing* — an app that never comes up and names nothing — while the form accepted it, and the page was left holding a refusal it could not explain. One predicate (`unknownName`) now answers at both doors. And the question itself is the door's own: an identity is chosen from the principals the door can name and a tool from the names `tools/list` answers with, so the page cannot be asked about an identity or a tool that does not exist — a typed box answered *Denied* for `agent-1` when the key is `app:agent-1`, a true answer to a question nobody meant. A name the door does not advertise is refused as such rather than answered by the walk the engine can still make without a tool, which admits for any agent bound to a live set (`Formal/Preview.lean`). Measured in the browser on the running gateway: the picker offered exactly `app:agent-1 / app:stranger` and the four advertised names, `app:agent-1 · effect-apps.app_read` answered Allowed, `app:stranger` answered Denied "no set bound to this agent", and `GET /mcp-gateway/access?tool=nope.x` answered Denied "no server offers nope.x" |

## Journey 1 — the operator

```
Home ──open an app──▶ App (screen…screen) ──up──▶ … ──up──▶ Home
  │                                                          
  ├── Settings ──one row per app──▶ config form ──save──▶ applied
  └── Activity ──read-only snapshot of the fleet
```

| step | owner surface | primary interaction | exit |
|---|---|---|---|
| choose where to be | **Home** (springboard; the Dock is the same job on wide screens) | open an app | dock / springboard |
| do the app's work | **App view**, one screen per task | the screen's own actions | up one level (F2) |
| change configuration | **Settings** (one row per configurable app → its form) | edit + save | up to Settings |
| see the fleet | **Activity** (read-only) | refresh, read | up to Home |
| call a tool by hand | **Tools** (developer surface, reached from the app it belongs to) | call, read the result | back to the caller |

Rules in force: F1–F5. The app view owns *acting*; Settings owns *configuring*;
Activity owns *observing*; none of them re-implements another's step.

## Journey 2 — the agent

```
connect ──▶ identified ──▶ discover (tools/list) ──▶ authorized ──▶ call ──▶ audited
```

| step | owner | what must be true |
|---|---|---|
| connect | the gateway's one door (`POST /mcp-gateway`) | one entry point; no second door with different rules |
| be identified | the gateway (token → principal) | F6: verified, not asserted |
| discover | the gateway's advertised surface | F8: the advertised set is the enforced set |
| be authorized | mcpset (what an agent may reach) + policy | F7: the binding an agent has is stored once, and the surface that writes it shows it |
| call | the gateway → the upstream server | F9: a refusal names its reason (set, rule, or unreachable server) |
| be audited | the gateway's audit record | every hop emits; the record is what the console reads |

## Journey 3 — an app

```
declare ──▶ registered ──▶ view lowered per screen ──▶ press ──▶ screen ──▶ back
```

An app declares views, screens and actions; the host guarantees F1–F4 on its
behalf. An app never draws chrome, never decides where Home is, and never keeps
its own copy of navigation state.

## What each rule cost, in code

- F1: `console-shell-menu.tsx` deleted; the status bar's Home control is the one
  way Home, and it is not drawn on Home itself — nor is the Dock, which is the
  same job on a wide screen.
- F2: `console-stack.ts` — the session's pushed destinations. Back is
  `history.back()` exactly when this session pushed the entry below, and the
  parent screen otherwise (`Formal/Stack.lean`).
- F3: `UiScreen.onEnter` — a screen names the action that loads it, run after its
  parameters are in the store, on every entry, press or cold. One path, not two:
  the press writes the values it was called with into the address and the screen
  reads them back from there, so a pasted address and a press are the same
  arrival (`Formal/Entry.lean`); and a url whose path names an id nothing
  supplied is not requested at all.
- F4: `UiActionSpec.refresh` — the reads to run again once a press succeeded,
  named by source id *or* by declared action. A refresh makes its call and writes
  its own answer, consumes no draft and enters no screen, which is what leaves
  the answer the press just wrote where the operator can read it
  (`Formal/Refresh.lean`). A press whose result only exists once its work is done
  declares that too — mantis waits the turn out, because a console with no event
  stream has no other way to reach the reply. And two doors into one read are one
  read: the url and the answer's path belong to the action, the value belongs to
  the press, so a row's `Read` and a `Start` field answer in one place
  (`Formal/Door.lean`).
- F5: `whenRows` — the list and the press that empties it, drawn from the same
  first-row predicate the "nothing here" notice reads, so one surface states the
  fact. The gateway's audit card was the third instance and the last one built by
  hand: `listCard` states the shape once for every console, and a section that
  wants its read's loading and failure above the rows takes `sourceStates` plus
  the same guard rather than a bare `table`. Then the app views and Settings, one
  slice per app; and a control whose gate path and send path are one name, so it
  is offered exactly when it can act (`Formal/Door.lean`). And what the catalog
  round answered is a column of the server it is about, not a list beside it —
  three states, because a server that is down is in neither of the round's two
  lists (`Formal/ServerListings.lean`).
- F9: `access-preview.ts` — the preview asks the gateway's own set registry and
  reads its answer, so the verdict the page states and the call the gateway
  carries are one value read twice. The set list it draws stays, as display, and
  the one predicate for "does this registry record reach" is the resolver the
  engine itself uses, so a set drawn as reachable is a set the engine would route
  through. The same defect one door out: a binding to a set nobody declares was
  refused by the registry with a throw and accepted by the form, so `unknownName`
  is asked by both, and a refusal the page cannot explain is no longer reachable
  (`Formal/Preview.lean`). The two things the question is *about* are the door's
  own lists — the principals it can name, and the names `tools/list` answers with
  — offered as bound `Select.Root`s in the conversion layer that already renders
  them, so no new control was built for them; the trigger's placeholder is how
  "no tool yet" is stated, since Radix forbids an empty-string item and a
  sentinel item would be a tool that is not one. Which of the four facts refused
  it is its own file, `access-reasons.ts`, and its order is the claim: a fact
  about the catalog cannot be a fact about a set, and an unbound agent is never
  sent to the registry for a server that was never the problem
  (`Formal/Reasons.lean`).
- F6: `door-auth.ts` — the door's own authentication, handed the two stores and
  not the resolving surface, so nothing an HTTP request carries can vouch for it.
  The identity order behind it stays claims → token → trusted headers, with a bad
  token ending the search (`Formal/Resolve.lean`); this is the file that makes the
  first two of those unreachable from outside, and what it hands its handlers is
  the hash and the principal, never the secret (`Formal/DoorAuth.lean`).
- F8: `mcp-surface.ts` — `visibleEntries` asks the gateway's own `decide` once per
  catalog entry and keeps the allowed ones, so the advertised list *is* the
  enforcement rather than a projection built to agree with it; `mcp-server.ts` is
  the one door, and its list, its call and its refusal all name the same verified
  principal (`Formal/Authorize.lean`).
- F7: `set-source.ts` + `live-sets.ts` — the fact moved to one home, and what
  crosses is a reader. `McpSetSlot` is the seam: the center hands over
  `{ facts: () => control.mcpsets() }`, a closure over its own state, and the door
  asks it at the moment it decides. The registry split is what holds the direction
  — `McpSetReader` is `bound`/`resolve` and the write half is separate, so the door
  can only read, because a surface that could add a set could add one the center has
  never heard of and the door would then enforce something no operator declared. A
  reload is the same app re-providing, which the slot allows; a *second* app taking
  it is refused, because that is the fact with two authors this slice removes
  (`Formal/SetSource.lean`). `makeLiveSets` rebuilds on the center's counter,
  mirroring `LiveCatalog`'s signature-keyed rebuild, and asks the slot on every read
  rather than capturing a source at load: apps are loaded in discovery order, and a
  door that captured one would hold no sets at all — for as long as it ran — if the
  center happened to load second. The duplicates the registry throws on moved into
  the one grammar (`set-schema.ts`'s `repeatedName`), which is what makes the rebuild
  total: what the center stores is what the door can build, in both directions.
  `x-agent-id` in `apps/agentd/src/adapter.ts` is the same shape one layer down and
  is not this slice: agentd still hands out a config the door refuses.
