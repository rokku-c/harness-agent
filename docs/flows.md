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

## The ten rules

| # | Rule | Why it is a rule, not a preference |
|---|---|---|
| F1 | **One control per destination.** A destination has exactly one control that reaches it, on exactly one surface. Another surface may link to it, never re-offer it. | ⌂ and ☰ were both live on every app screen, both going Home. A person reads two controls as two destinations. |
| F2 | **Up is one level, and it is always in the same place.** The leading control goes to the parent screen; at an app's first screen it goes Home. Never `history.back()` unconditionally. | `screen-bar` called `history.back()`, whose own comment conceded it can land on "the page the reader came from" — a pasted link has no history, so Back left the product. |
| F3 | **A destination is complete on arrival.** The address names the screen *and* what it shows; arriving cold builds the same screen with the same content as arriving by press. A screen that needs data declares how to load it — and a load its address does not name is not attempted. | `#view/board/task?taskId=…` rendered *"No task is open. Pick one from the board."* — the parameter was written to the URL by the press and read by nothing. Measured live. The same rule a second time: `#view/board/task` with no id sent `GET /board/api/tasks/` and answered "Unknown Board route" beside the empty sentence — a request about a path the declaration never described. Measured a third time, and this is the rule's hard edge: three views whose screens the host had to read off their layout (`screen-derive.ts`) and two the reading refused (`ai-gateway`, `mantis`, `deckconsole`) were still one long page — and one of the five was worse than long. The MCP registry's derived screens left the credential both of its write acts need on the first screen while the acts themselves moved to screens of their own, so `#view/mcp-registry-app/register-a-server` arrived at a Register press with nothing to authorize it and no control anywhere on that surface that could supply one. The reading `screen-derive.ts` takes asks whether a control and its own answer travel together; it does not ask whether a destination can be *completed* where it lands. All nine product views now declare their own `screens`, and each act carries the credential it needs on the screen that makes it — the registry holds one token per server id, so a box on the list would authorize a press for a server it cannot name. |
| F4 | **An action's result appears where the press was.** A press names the reads its result changes, and a re-run read is a read and not a press — it makes its call and writes its own answer; it consumes no draft and enters no screen. What a press fills sits *after* it in reading order, where the eye already is. | deckconsole's `deck.send` wrote `/result/turn` and refreshed only the session list, while the transcript on the same page reads `/opened`, which only `deck.select` writes: send a turn and the answer never appeared. The product had two kinds of read — a source and a read-action — and only the first could be re-run. `refresh` now names either, and a press that made no call consumes nothing. Proven: `Formal/Refresh.lean`. The same rule a second time, in mantis: `mantis.send` fired the turn and answered "accepted", and the reply arrived on an event stream the console does not have, so the transcript under the button never showed it — the turn is now waited out, and the timeline is one of the reads the press re-runs. And the order: the conversation a row's `Read` fills used to be drawn *above* the rows that chose it, so a press changed what was behind the reader, past two empty cards that each said "press Read" — the doors now come before the room they open, and the room is a screen rather than a card under the list: entering it is what fills it, so the read that answers the press is the one the door leads to. |
| F5 | **One surface writes a fact.** Other surfaces read it or link to the writer. | Configuration is written on Settings *and* reachable as `#config/<app>`, which mounts nothing and answers with an error callout. Two doors, one of them painted on. The same shape at the list: a card showed a table's header row under the notice saying the list was empty — the notice said the true thing and the bare header said there were columns of nothing, on four cards of one page. A list is now drawn only while it has a first row (`whenRows`), from the same predicate the notice reads. The same defect a third time, on the gateway's own console: its audit card built its table by hand beside `sourceStates`, so the notice said no decisions had been recorded and a bare header under it said there were columns of nothing — measured in the browser, on the page an operator opens to find out what the gateway refused. And the same shape as a fact written twice: mantis's composer addressed a `message.conversationId` of its own while the timeline showed the read's answer, so a message could be typed beside a timeline it was not addressed to. The conversation the page is about is now the read's own answer — one path, written by the read, shown by the timeline, named by the composer and carried by its button. And a surface that *promises* a fact must carry it: the gateway's tool picker said "Topology names what each server answered" while Topology drew three lists that did not include it, and the operation's own description claimed the same thing — so the load report is now a column of the server row it is about (`listed`, `failed` with the sentence the upstream returned, or `not asked` for a server that is down), because an offline server appears in neither of the report's two lists and a column reading the report alone would leave the likeliest case unsaid. Measured live: with the upstream's endpoint pointed at a 404 the row read `healthy · failed · Streamable HTTP error: …`, and pointing it back read `healthy · listed`. And a screen is a surface: the states of a read belong to the screen that read feeds — stated once, above every list on it, and never once per list — while the emptiness of a list belongs to that list, because lists under one source read `ready` while any one of them has a row. agentd stated one failed read four times on one page before this. |
| F6 | **One identity, checked at one door.** An agent is identified by a credential the door verifies; a header is a hint, not an identity. | `mcp-server.ts` accepted any `x-agent-id`; `authenticate` was never supplied, so `authInfo` was always undefined and any caller could assume another agent's sets. The door is now `door-auth.ts`, and it is handed the two stores rather than the whole resolving surface, so `trusted` and `claims` — the fields that let a *transport* vouch for what it passed through — cannot be set by an HTTP request; the headers of one are read as a single thing, the bearer token (`Formal/DoorAuth.lean`). Measured live on one running gateway, four callers at `POST /mcp-gateway`: a credential for `app:agent-1` was named and carried its call through; the same request carrying `x-agent-id: agent-1` and no credential was named nobody and refused `401 no credentials`; a forged bearer token, `401 invalid token`; a *valid* credential for an unbound `app:stranger`, named nobody and refused `404 no_server`. The header decides nothing in any of the four. |
| F7 | **One store per fact, and the surface that writes it shows it.** | The set an agent reaches the gateway through was declared twice — in the center that issues the identity a binding is keyed by, and again in the gateway's own config — with nothing between the two, so an operator who bound an agent over `agentd_bind` found the gateway page still answering *"No agents bound to a set yet."* The gateway's `sets`/`bindings` config fields are gone, not deprecated; the center is the one home, and what crosses to the door is a **reader over the center's own state** rather than a copy of it (`context.mcpSets`, the same shared-surface shape as `context.mcpRegistry`), so the door holds no second copy and there is nothing to keep in step. The seam refuses a second author — `provide` throws if an app other than the one holding the slot takes it, and a reload is the same app re-providing, which is allowed — and the door rebuilds on the center's **revision**, never on a clock, so there is no period in which it decides with a binding its operator has already replaced (`Formal/SetSource.lean`). The rebuild is total by construction rather than by try/catch: the duplicates the registry throws on are refused by the one mcpset grammar, which the center's config loader and its `agentd_upsert_mcpset` op both parse with, so a stored declaration is one the door cannot fail to build. The gateway's config schema refuses `sets`, `bindings` and `defaultAction` outright, and the end-to-end test declares the set and the binding on the center and the door serves them. |
| F8 | **What a door advertises is what it enforces.** | `tools/list` answered one multiplexed `mcp_gateway_call` while the page copy said "one governed MCP entry point for every agent" and the per-tool surface was unbuilt. The listing is now not a second rule that agrees with the call — it *is* the call, asked once per tool: `visibleEntries` offers every catalog entry to the gateway's own `decide` and keeps the ones it allowed, so a tool missing from `tools/list` is a tool `tools/call` refuses, and the call runs that same `decide` with the same arguments (`Formal/Authorize.lean`). Measured live on the four callers above: the caller who could carry a tool was shown four, and the one call that went through came back naming the server and the set that carried it; the three who could carry nothing were shown nothing, before any of them asked. |
| F9 | **One decision engine per verdict.** A preview must be the decision, not a copy of it. | `access-audit.ts` re-implemented `sets.ts` — the file's own comment said the copy existed "precisely because it can drift", and it is what the operator reads before granting. It now asks the gateway's own registry (`reach`, `resolve`, `bound`) and reads the answer, so the page's Allowed and the call's outcome are one value read twice rather than two computations that happen to match. The same rule a second time, at the config: the registry refused a binding to a set nobody declares by *throwing* — an app that never comes up and names nothing — while the form accepted it, and the page was left holding a refusal it could not explain. One predicate (`unknownName`) now answers at both doors. And the question itself is the door's own: an identity is chosen from the principals the door can name and a tool from the names `tools/list` answers with, so the page cannot be asked about an identity or a tool that does not exist — a typed box answered *Denied* for `agent-1` when the key is `app:agent-1`, a true answer to a question nobody meant. A name the door does not advertise is refused as such rather than answered by the walk the engine can still make without a tool, which admits for any agent bound to a live set (`Formal/Preview.lean`). Measured in the browser on the running gateway: the picker offered exactly `app:agent-1 / app:stranger` and the four advertised names, `app:agent-1 · effect-apps.app_read` answered Allowed, `app:stranger` answered Denied "no set bound to this agent", and `GET /mcp-gateway/access?tool=nope.x` answered Denied "no server offers nope.x" |
| F10 | **An agent's identity is spelled the door's way, and its credential is declared with it.** The center names an agent by the key the door resolves a credential to, and the config it plans carries a credential and nothing else. | F6 removed the claim at the door, and one layer down `apps/agentd/src/adapter.ts` was still *writing* one: the config planned for every agent carried `headers: { "x-agent-id": <the agent> }` — a caller telling the door who it is, in the one place a caller can never be verified. It now carries the credential and no claim (`Formal/Credential.lean`). The identity is a fact before it reaches anything: the center refuses an agent whose id is not `kind:id` — `parsePrincipalKey`, the door's own grammar rather than a copy of it — because the door binds by the key a credential resolves to, so an agent named any other way is a set of bindings nothing can ever reach, the same shape F9 recorded once already as a typed box answering *Denied* for `agent-1` when the key is `app:agent-1`. The credential is **declared** against that id (`agentd_credential`, `credentials:` in the center's config) and the plan is made from what the center holds, never from a reading: the gateway mints a fresh plaintext per `issue()` and stores only its hash, so a center that asked each time would report a credential change on every plan, never settle the apply, and leave one more live credential for one identity per reading. Holding it is not a second copy of the gateway's record — that record is a hash and a revocation, and a plaintext exists wherever it is used, which for an agent is a config file, exactly as `nodeToken` does at the center. It sits beside the agent record and not on it, so listing the fleet is not a way to read a secret — and the read surfaces *state* it rather than showing it: `agentd_status` and `agentd_desired` are `access: "read"`, which an agent may hold a grant on, so `shownToReader` answers `credentialHeld` and never the value, the way `nodeLiveness().tokenRequired` answers for the fleet's shared secret. The console draws that word in the agents table and in the row's own Inspect answer, so an operator sees which agents the door will refuse; the value is read back where it is written, in the configuration form that declares it. Measured in process on the real modules — the config schema, its seed, the control plane, the status view, the `agentd_desired` handler and the adapter: a declared credential reached the plan as `{"authorization":"Bearer …"}` and nothing else, both read surfaces answered `credentialHeld` with no value anywhere in them, the agents view validated and kept both words through lowering, an id that is not `kind:id` was refused *"agent-9" is not a principal key*, an agent holding no credential was refused a plan at all, and a plan offered its own receipt reported `[]`. In process rather than over HTTP because a plane reload cannot pick up a change inside `packages/*` — Bun freezes a module's namespace for the life of the process — and this change reaches into `packages/agentd`. |

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
planned ──▶ launched ──▶ armed ──▶ connect ──▶ identified ──▶ discover (tools/list) ──▶ authorized ──▶ call ──▶ audited
```

| step | owner | what must be true |
|---|---|---|
| be planned | the center (agentd, `setCredential`) | F10: named the door's way, and its credential declared with it |
| be launched | the caller (`agentd_launch`) → the center → the machine that claims it (`POST /agentd/launch/poll`) | a caller names an *identity* and nothing derived from it: the machine and the dialect are read from the center's own record of that identity, and one the center holds no record of queues nothing at all. A launch is a turn or a command, and only a turn has an identity — so there is no shape in which a caller names both an identity and the process to start it as. One field is carried rather than derived and decides none of the rest: the task the work is filed under, optional, absent meaning asked for by hand. On the console the caller is the operator, and the press lives *inside* the agent's own answer so the identity it carries is the one that answer just named — the same rule one layer down, at the tier the operator works at. The intent it queues is the fleet's record and is read on the first screen with the rest of the fleet; the press's own answer — which machine the identity resolved to — stays in the card it was pressed in (F4) |
| be armed | the machine that runs it (`GET /agentd/gateway`), before it starts | F10: the config, fetched for the intent's own identity and served only to the node credential. The fetch is not a step beside the start but what the start is conditional on: a refusal settles that one intent `failed` with the reason — naming nobody's credential, or a center that cannot say where its door is — and nothing is spawned. An agent started anyway and turned away at every call would report a *permission* problem, which is not what it has (`Formal/Arming.lean`) |
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
behalf. All nine product views declare their screens, so the reading the host can
fall back to (`screen-derive.ts`) is a safety net no product relies on. An app never draws chrome, never decides where Home is, and never keeps
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
  supplied is not requested at all. Every view declares its own `screens` — no
  product view leaves them to be read off its layout — and the id an entry names
  reaches the screen the same way a press's does, out of the address.
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
  lists (`Formal/ServerListings.lean`). And at the screen: `emptyRows` states a
  list's own emptiness inside its section, while `loadingRows` and
  `failureNotice` for the read are stated once per screen, above every list that
  read feeds — a screen is a surface, so `listStates` per list was one failed
  read said four times on one page.
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
- F10: `agentd/src/adapter.ts` — `x-agent-id` is gone from the planned config and
  the header it carries is the credential and nothing else, so what an agent
  presents decides its name and what its config says about itself decides
  nothing (`Formal/Credential.lean`). The two halves of one identity are held
  apart on purpose. The *spelling* is `effect-authz`'s `parsePrincipalKey`, the
  door's own grammar imported rather than copied — the F7 lesson, that a rule
  with two homes drifts — enforced where an identity is declared, so the center
  cannot name an agent the door can never resolve. The *secret* is
  `control.credentials`, a map beside `agents` rather than a field on it, for the
  same reason `bindings` is: a record that carried its own secret would put it in
  every listing of the fleet. And it is declared, not minted per plan:
  `a_credential_read_per_plan_never_settles` is the property that chose the
  design — the gateway's `issue()` returns a fresh plaintext every call, so a
  center that asked each time would report a credential change on every plan,
  never settle the apply, and leave one more live credential for one identity per
  reading. Holding it is not the second copy F7 removed: the gateway's record is
  a hash and a revocation, and a plaintext is plaintext wherever it is used —
  which for an agent is a config file, exactly as `nodeToken` is at the center.
  What a *read* surface hands back is `apps/agentd/src/desired-view.ts`
  (`shownToReader`): the desired state with `credentialHeld` where the value
  would be. The center is the holder, so the value is not hidden from the
  operator — it is read back on the surface that writes it, and the listing an
  agent can hold a grant on states the fact instead. The console draws both
  states as words (`stated` in `effect-ui-cells.ts`), in the agents table and in
  the row's Inspect answer, because "which agents will the door refuse" is the
  operator's question and it is answered by a word, not by a secret.
- F10, second half: `packages/agentd/src/control-config-ops.ts` +
  `apps/agentd/src/ops/gateway-op.ts` — a plan nobody can fetch is the same defect
  as no plan at all, and until this the adapter had no caller outside its own
  test. The config is **served** to the machine that will write the file, at
  `GET /agentd/gateway`, guarded by the node credential exactly as
  `/agentd/artifact` is — a plaintext secret is fetched, not browsed, which is
  also what the fleet's one token buys and the reason the guard is checked before
  anything about the fleet is read. Three things
  belong to the request and two to the center, and the model is that split
  (`Formal/ConfigFetch.lean`): the caller presents the node credential, names the
  agent, and says what it already runs; the center declares the door and holds the
  credential. So a machine offered the config it is already running gets the same
  bytes and an empty diff, a caller cannot name the door it is pointed at, and an
  agent holding nothing is refused rather than handed an empty header that would
  be turned away at the door, far from whoever could have issued one. The door's
  address is declared once for the fleet (`gateway:` in the center's config, and
  `gatewayUrl` on the control plane, checked before the agent is looked up so a
  refusal about the request never reports the fleet's state) rather than per
  agent: the door is one, and a second author for one address is the shape that
  lets two agents on one machine disagree about where the platform is. What that
  slice did not build is the other side of the wire — the probe fetching it and
  the CLI dialects rendering it.
- F10, third: the launch — `agentd/src/launch-types.ts`, `apps/agentd/src/ops/launch-ops.ts`,
  `agentd-probe/src/launch-order.ts` + `launch-cycle.ts`, `agentdeck/src/adapters/cli-mcp.ts`
  + `cli-preset.ts` (`Formal/Arming.lean`). A launch is a *turn* or a *command*, and the
  difference is who the machine is when it runs: `agentd_launch` takes an identity and
  nothing derived from it, and the center fills the machine and the dialect from its own
  record of that agent — which is why the two are not fields a caller may set, and why an
  identity the center holds no record of queues nothing rather than work onto a machine
  nobody chose. The config is fetched **per intent, before the start**, and that order is
  the rule: `runLaunches` settles the intent `failed` with the reason when the fetch is
  refused, so nothing is spawned believing the platform's tools exist. The refusal is
  `plan` and only `plan` — a sentence about one agent — so it is absorbed per intent and
  the beat continues; a 401 is about this machine and halts, leaving the intent claimed to
  lapse back rather than marking as failed work nobody ever judged. What the dialect does
  with the config is the dialect's own: `claude` takes it as one inline `--mcp-config`
  word (which is why the token is in an argv any process on that machine can read, the
  price of the only inline route it has) plus `--strict-mcp-config`, without which the
  agent also loads its own home directory's servers and the set the platform bound is no
  longer the set the agent can reach; `codex` names the door by dotted path and reads the
  token from the environment it is given, so the secret never reaches its argv; `gemini`
  and `pi` have no per-run route at all and an explicit command has nowhere to put a
  dialect's words, so all three are **refused** rather than started with their servers
  dropped. The credential reaches the process by one route and one only:
  `normalizeConfig` never fills `mcp`, so a config read back from a saved launcher or drawn
  in a console form has none however its raw object was spelled — no surface that *draws* a
  config can be drawing a secret — and the config a `TurnOrder` carries is the only thing
  that supplies one.

## What was measured, in the browser

Every screen shape above was driven in a real browser over CDP, against a second
server on another port booted from the same source — not against the dev server,
which was left serving. Nine product views × their declared screens, each entered
by address (`#view/<app>/<screen>?<params>`), at 400px and at 1280px:

- **A root is one screen.** One pane, no bar, the surface's own doors drawn on it,
  no horizontal scroll, and the shell body does not scroll it. All nine, both
  widths, and again at a 430px-tall window: the doors stayed on the surface and
  nothing overflowed, so a short window does not push a destination off the
  screen that offers it (F1).
- **A screen is complete on arrival.** Every declared screen entered cold built
  itself — the read its `onEnter` names ran from the address alone. A screen whose
  address names no entity made no call and said so on itself: agentd's
  `/agent?agentId=none` answered *agent not found* on the agent screen, board's
  `/task?taskId=none` *Task not found*, deckconsole's `/session?sessionId=none`
  *unknown session*, mantis' `/conversation` *No conversation is open. Pick one
  from the list.* (F3). No address produced a request about a path its declaration
  never described.
- **Narrow is one pane and a way up; wide is two.** At 400px a screen is one pane
  with `‹ Back` above it; at 1280px the screen it came from is drawn to its left
  and the bar still reads the current screen's title. A window *resized* while a
  screen is open — 400 → 1280 → 700 → 1024 → 400 — collapsed and expanded with the
  bar intact and no reload: one pane, two, one, two, one (F2).
- **A press's answer appears where the press was.** herdr's fleet row pressed
  *Open* landed on `#view/herdr/agent?target=w3%3Ap1` carrying herdr's own answer
  for that pane (*cannot read 200 lines while w3:p1 is working…*); ui-host's
  *Set theme* changed *Theme in use* from `warm-paper` to `default` on the same
  screen that holds the picker; mcp-registry's *Load preview* answered
  *server not found* on the preview screen; mantis' *Add record* with no kind
  answered *kind and text required* on the workspace screen; the gateway's row
  read answered in the row's own card. Nothing was written to a surface the
  operator was not looking at (F4), and no list stated a read's state beside a
  screen that had already stated it (F5).
- **Up one level, both ways.** `‹ Back` popped the screen, and so did the
  browser's own Back — from agentd's Launches, board's opened task, and the
  gateway's Identities — each returning to the screen it was entered from rather
  than to the page before the console.

The MCP journey's door was driven on that server too, with the four callers F6
records: a bearer token that resolves carried the call, a request with **no**
credential answered `401 · deny · no credentials`, a forged bearer answered
`401 · deny · invalid token`, and `x-agent-id` presented alone named nobody — the
preview beside it answering `bound: false` with its reason for an identity that
reaches nothing. The console's own screens for the journey — Identities, Topology,
Recent decisions and the registry's Servers, Register, Withdraw, Preview — are
among the nine above.

One thing the running server cannot show and a restart will: its `agentd` plane
was loaded before the commit that gave `packages/effect-interface` its `json`
field builder, and a plane reload copies only an app's own directory — Bun freezes
a `packages/*` namespace for the life of the process, which is the same limit F10
records for measuring in process. `agentd` is therefore still serving the screens
the host read off its layout, on that one process, until it is restarted; every
other view reloaded onto the declared shape. This is a property of a long-running
process, not of the source: the same source booted fresh serves all nine declared.
