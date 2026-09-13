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
| F3 | **A destination is complete on arrival.** The address names the screen *and* what it shows; arriving cold builds the same screen with the same content as arriving by press. A screen that needs data declares how to load it. | `#view/board/task?taskId=…` rendered *"No task is open. Pick one from the board."* — the parameter was written to the URL by the press and read by nothing. Measured live. |
| F4 | **An action's result appears where the press was.** | deckconsole's `deck.send` writes `/result/turn` and refreshes the session list, while the transcript on the same page reads `/opened`, which only `deck.select` writes. Send a turn and the answer never appears. |
| F5 | **One surface writes a fact.** Other surfaces read it or link to the writer. | Configuration is written on Settings *and* reachable as `#config/<app>`, which mounts nothing and answers with an error callout. Two doors, one of them painted on. |
| F6 | **One identity, checked at one door.** An agent is identified by a credential the door verifies; a header is a hint, not an identity. | `mcp-server.ts` accepts any `x-agent-id`; `authenticate` is never supplied, so `authInfo` is always undefined and any caller can assume another agent's sets. |
| F7 | **One store per fact, and the surface that writes it shows it.** | Sets/bindings live in agentd's control state *and* in the gateway's config, with nothing synchronising them: bind an agent in agentd and the gateway page still reads "No agents bound to a set yet." |
| F8 | **What a door advertises is what it enforces.** | `tools/list` answers one multiplexed `mcp_gateway_call` while the page copy says "one governed MCP entry point for every agent" and the per-tool surface is unbuilt. |
| F9 | **One decision engine per verdict.** A preview must be the decision, not a copy of it. | `access-audit.ts` re-implements `sets.ts` — the file's own comment says the copy exists "precisely because it can drift", and it is what the operator reads before granting. |

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
  way Home, and it is not drawn on Home itself.
- F2: `console-stack.ts` — the session's pushed destinations. Back is
  `history.back()` exactly when this session pushed the entry below, and the
  parent screen otherwise (`Formal/Stack.lean`).
- F3: `UiScreen.onEnter` — a screen names the action that loads it, run after its
  parameters are in the store, on every entry, press or cold (`Formal/Entry.lean`).
- F4/F5: the app views and Settings, one slice per app.
- F6–F9: the gateway and agentd, one slice per rule.
