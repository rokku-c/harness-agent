# Usage flows: the console, its agents, and its governance

The interaction-flow specification for the console that replaces the four UIs deleted in
`plan.md` §5. It is written to be implemented against without a further question.

**Conventions.**

- Every claim about what exists today cites one of the five source documents as
  `(console-surface §2)`, `(app-surfaces: board)`, `(auxiliary-hosts §1)`, `(plan §5)`,
  `(CLAUDE.md)`. Nothing about current behaviour is asserted without such a citation. One
  claim, in §1.6, is marked **(verified in source)**: the source documents are silent on it
  and it decides a flow.
- A three-part name is used throughout: **place**, **app**, **screen**, plus one more object
  the flows force into existence, the **decision** (§1.5).
- The document is the specification. Where today's design has a dead end, a missing state,
  or two things that mean different things by one name, it says so and designs the fix.

---

## 1. The information architecture

### 1.1 What the console is

An operator console for a running effect-agent host: it runs AI coding agents on machines,
gates what they may do behind approvals, registers MCP servers, brokers which agent may
reach which server, and exposes the nine app surfaces inventoried in `app-surfaces.md`. Its
users are the developers and operators who live in it daily (`plan.md` §6).

### 1.2 The three nouns, defined

**A place** is a destination the host owns. It exists when zero apps are registered, it has
an address with no app id in it, it is reachable from every other place in one action, and
its content is assembled from contributions by apps that do not know about each other.

**An app** is a unit with its own domain data, its own service, and its own lifecycle. If
every app were unregistered it would not exist. It names itself, marks itself and declares
its own surface through the catalogue; the console holds no list of app ids and no per-app
knowledge (`console-surface §1`).

**A screen** is one job to be done inside one app. It has its own name, its own address, and
its own parameters, and it can be linked to and returned to (`app-surfaces.md`: every app
declares its screens explicitly).

**A state within a screen** is not addressable. A panel, a sheet, a dialog, a tab, a row
selection and a draft are states. If it needs an address, it was a screen.

### 1.3 The rule that decides which a new thing becomes

Applied in order. The first clause that matches wins.

| # | Test | Becomes |
|---|---|---|
| 1 | It must exist, and be useful, when zero apps are registered. | **Place** |
| 2 | Its content is a merge of contributions from apps that must not know about each other. | **Place** |
| 3 | Deleting every app would delete it, and it owns its own store and its own service. | **App** |
| 4 | It is a distinct job within one app, with parameters of its own that a colleague could be sent. | **Screen** |
| 5 | None of the above. | **A state within a screen** |

Worked applications of the rule, which are the ones this document depends on:

- The host's service list, its registered operations, and its failure record survive zero
  apps, so they are places (Activity, Tools).
- The per-app configuration editors survive zero apps as a *place* (Settings) and are also a
  *screen's* worth of content per app, which is why Settings has one address per app (§1.6).
- A decision waiting on a human survives zero apps and merges contributions from several,
  so it is a place-level object, not a mantis screen and not a deckconsole table (§1.5).
- "The MCP registry" is an app, because the registry service is a thing that can be absent
  (`app-surfaces: mcp-registry-app`). Its *read-out* inside agentd is a screen of agentd
  (`app-surfaces: agentd`), and the two are joined by a link, not merged (§5).
- "Preview a `ui://` resource" is a state within whichever screen needs it, because the
  preview component already renders one resource and has no parameters of its own beyond the
  two the screen already holds (`console-surface §4`, `app-surfaces: mcp-registry-app`).

### 1.4 The shape this document settles on

**Five host-owned places, plus apps at their own address, plus decisions as addressable
objects.**

| Place | Address | What it is |
|---|---|---|
| **Home** | `#` | The springboard: every app as a tile, and a short "needs you now" strip. Home is the app index; there is no separate Apps page. |
| **Inbox** | `#inbox` | Everything waiting on a human, in one queue, from every app and from the platform. Two kinds of item: **decisions** (a verdict is needed) and **action items** (one recovery action is needed). |
| **Activity** | `#activity` | The host's own record: services, registered apps and operations, decisions, config changes, failures, and who did each thing. |
| **Tools** | `#tools` | Every operation every app registered, with its schema, runnable and inspectable, whichever transport it arrived on. |
| **Settings** | `#settings` | Configuration, per app and per host: app config schemas, the operator identity the console acts as, channels, attention rules, and the platform's own listeners and egress policy. |

| Object | Address | What it is |
|---|---|---|
| **App surface** | `#app/<id>` | Everything one app declares, entered at its start screen. |
| **Screen** | `#app/<id>/<screen>?<params>` | One job inside that app. |
| **Per-app settings** | `#app/<id>/settings` | The same editor Settings links to, reachable without leaving the app. |
| **Decision** | `#inbox/<decisionId>` | One thing waiting on a human, linkable, with the app it belongs to as a field, not as its location. |

The address grammar, complete. It replaces `console-surface §2` in full; the two config
spellings (`#settings/config/<id>` and `#config/<id>`) become one, because one screen
answering two addresses means an operator cannot tell which link they were handed.

| Address | Renders |
|---|---|
| `#` | Home |
| `#inbox`, `#inbox/<decisionId>` | Inbox; Inbox with that decision open |
| `#activity`, `#activity?actor=&app=&kind=since=` | Activity, filtered |
| `#tools`, `#tools/<app>`, `#tools/<app>/<tool>` | Tools; scoped to an app; one tool open |
| `#settings`, `#settings/<app>` | Settings; Settings with that app's editor open |
| `#app/<id>`, `#app/<id>/<screen>`, `#app/<id>/<screen>?<params>` | The app start screen; a named screen with its parameters |
| `#app/<id>/settings` | That app's configuration, in place |
| an address that resolves to nothing | Not found, **with the address preserved** (§2.H13) |

Rules that carry over from `console-surface §2` unchanged, because they are right: the URL
hash is the only route record and React state is derived from it, so a click, a pasted link
and the browser's back button take one path; ids and screen names are percent-decoded with a
fallback to the raw value when decoding throws; navigating to the address already shown
creates no history entry. Rules that change: a stale address is **not** rewritten with
`replaceState` and is **not** silently resolved to Home or Settings; it renders Not found
with the address kept and the recovering action offered (§2.H13).

### 1.5 The decision, and why it is a first-class object

The product's weakest join is that an approval can arrive in four unrelated places: the
console's mantis screen (`mantis.allow`/`mantis.deny`, `app-surfaces: mantis`), the deck's
consent table (`deck.allow`/`deck.deny`, `app-surfaces: deckconsole`), a DingTalk card
(`auxiliary-hosts §1`), and an MCP tool (`mantis_approve`, `auxiliary-hosts §1`). A human
looking at the wrong one cannot answer, and the agent is stuck.

A **decision** is therefore an object the platform owns:

| field | meaning |
|---|---|
| `id` | Stable, linkable, unique for the life of the host's record. |
| `class` | `call.foreground`, `call.background`, `write.protected`, `channel.startup`. Determines the deadline and the routing. |
| `raisedBy` | The app or `platform` that asked for the gate. |
| `raisedFor` | The principal whose call is blocked. |
| `subject` | The operation and its arguments, in full, readable by a human. |
| `reasons` | Why the gate stopped it, in the access engine's own words. |
| `deadline` | An absolute time. |
| `state` | `waiting`, `answered`, `expired`, `withdrawn`, `already-answered-elsewhere`. |
| `verdict`, `answeredBy`, `answeredAt`, `answerSource` | Filled once, by the first verdict, from any surface. |
| `recovery` | The one action that fixes it when the answer is deny. |

An **action item** is the second Inbox kind and is not a decision: it has no verdict, only
one recovering action. "Configuration saved, a restart is pending" (`console-surface §5`,
the `pending` tone), "a source has failed repeatedly", "an app is registered but its service
is disabled", and "a channel is refusing to start" (`auxiliary-hosts §1`: DingTalk refuses
startup without an owner or a card template; the dws channel refuses without `meUserId`) are
all action items. They were previously invisible or stderr-only, which is the 3am problem
(§5.5).

### 1.6 Evaluation of today's shape

Today: Home springboard, then an app, then screens within it, with Settings, the tool
inspector and Activity as special-cased siblings (`console-surface §3`, §7).

**What holds and is kept.** Apps as the unit; screens within an app; the springboard as the
way in; the hash as the single route record; the rendering contract in `console-surface §4`
unchanged; the config surface's status-callout-plus-generated-form in §5 unchanged.

**What fails, with the evidence, and the fix.**

| defect today | evidence | fix |
|---|---|---|
| The three siblings are three different mechanisms, though all three are host-owned places. | Activity is an app-shaped view route special-cased in the shell (`console-surface §2`, `§3`); Settings is a plan entry special-cased inside `appRoute` (`console-surface §2`); the inspector is served under `#view/<app>`. | One mechanism: five places, one address each, one contribution registry. |
| There is no place for the thing the product most needs: a decision waiting on a human. | Approvals exist only inside mantis and deckconsole (`app-surfaces: mantis`, `: deckconsole`). | Inbox (§1.4, §5.1). |
| `#view/<app>` renders two unrelated surfaces depending on what the app registered, and an app that has both a view and tools gets only the view, so **its tools are unreachable**. | `console-plan.ts:46` marks an app that registers tools as `hasView`; `console-views.tsx` mounts either the view or the inspector, decided server-side, and the comment there says "the tool inspector for an app that only registers MCP". **(verified in source)** | A view address is a view and a tools address is a tool set. Every app is inspectable at `#tools/<app>` whether or not it draws. |
| Two spellings for one config screen. | `console-surface §2`: `#settings/config/<id>` and `#config/<id>` resolve identically. | One spelling, `#settings/<app>`. |
| A stale address is silently resolved elsewhere and rewritten, so a broken deep link looks like a working one. | `console-surface §6`, `Absent`: "There is no not-found screen". | Not found keeps the address (§2.H13). |
| Config is reachable only by leaving the app, going Home, docking to Settings, and reselecting. | `console-surface §3`: on an app route there is no app switcher; the dock is drawn only on document routes. | `#app/<id>/settings` in place, plus a persistent app switcher (§2.H6). |
| Activity is an app-shaped thing that is not an app. | `console-surface §2`, `console-shell.tsx:59` special-cases `#view/activity`. | `#activity` is a real address of a real place. |
| Nothing in the chrome has an address of its own except Home and Settings, so the console's own posture (who am I acting as, which channels are live) has nowhere to be seen. | `console-surface §3` lists the whole chrome: brand, Home, title, status line, clock, appearance. | Settings holds Operator, Channels, Attention, and the read-only platform posture. |

**Verdict: the shape changes.** The three siblings do not hold, for one reason that recurs
in every row above: they are three answers to one question, and the question they were not
asked is "where does a decision wait?".

### 1.7 Vocabulary: one word per thing

Twelve collisions exist today. Each is resolved to one word, and the losing word is not used
anywhere in the new surfaces, in code identifiers, or in copy.

| one word | what it means | the words it replaces, and where they are used today |
|---|---|---|
| **decision** | One thing waiting on a humane verdict. | "approval" (`app-surfaces: mantis`), "consent" (`app-surfaces: deckconsole`), "pending protected call" (`auxiliary-hosts §1`), "decision" (`app-surfaces: mcp-gateway-app`). |
| **verdict** | `allow` or `deny`, the answer to a decision. | "resolve". |
| **grant** | A standing permission, held before anything is asked. | "consent policy" (`auxiliary-hosts §1`, deckconsole's auto-approve list and default decision). A grant is not a decision. |
| **principal** | Anything that can be identified and authorized: an agent, a user, the platform. | "identity" (the mcp-gateway screen title, `app-surfaces: mcp-gateway-app`) against "principals" (its own URLs). |
| **token** | The credential a principal presents. | "server token" for a registry credential, which stays a token but is always qualified as "the server's own token". |
| **operation** | One declared capability, projected to HTTP and to tools. | "tool" and "interface" (`auxiliary-hosts §1`, `effect-interface`). A tool is what an agent sees; an endpoint is what HTTP sees; both are projections of one operation. |
| **actor** | Who caused a change: `human`, `agent`, or `system`, with an id. | Nothing today; this is the missing field the attribution join needs (§5.3). |
| **agent** | An AI instance running under the host. | Collides today between agentd's fleet agents (`app-surfaces: agentd`) and herdr's terminal agents (`app-surfaces: herdr-app`). Resolved by qualifying: **fleet agent** and **terminal agent**, never bare "agent" in copy. |
| **conversation** | A threaded exchange with an agent, held by one app. | Collides with "session" (deckconsole, `app-surfaces: deckconsole`) and "room" (`app-surfaces: mantis`, "opens a room"). Use **conversation** in mantis and **session** in deckconsole, and never the other's word inside the other's surface. |
| **workspace** | Collides outright: mantis's declarative record store (`app-surfaces: mantis`) against herdr's terminal workspaces (`app-surfaces: herdr-app`). | Mantis's becomes **records**; herdr keeps **workspaces**. Neither surface may show the other's word. |
| **Activity** | The host's record. One place. | Collides with ui-host's `activity` screen ("what agents using this canvas announced") and ai-gateway's `activity` screen ("the twenty newest exchanges"). Both are renamed: **announcements** and **exchanges**. |
| **registry** | Collides: agentd's `registry` screen reads MCP servers and their sets (`app-surfaces: agentd`), while the mcp-registry app is the service that holds them (`app-surfaces: mcp-registry-app`). | agentd's screen becomes **MCP servers**; the app keeps "MCP Registry". |

One further naming rule, from `CLAUDE.md` and `plan.md` §6: English only, one term per concept,
no mixed-language surface. The DingTalk card's approve and deny button labels are template text
configured outside this repo (`auxiliary-hosts §1`); the new channel contract requires the
card's verdict fields to be `action=approve` and `action=deny`, which is what the card's own
verification reads (`auxiliary-hosts §3`, `CardVerdict`), so the language of the visible label
and the language of the verdict field stop being the same question.

---

## 2. The human flows

Each flow is a numbered path with the screens and controls it traverses, then its loading,
empty, error and stale branches. `→` means "then". Controls are named by the state path or
component they are, as `app-surfaces.md` records them.

Shared state rules that apply to every flow and are not repeated below:

- **Loading.** A place renders its chrome, its heading and its own controls immediately. A
  surface with no data yet shows a skeleton sized to its final content, and after 300ms a
  sentence naming what is being read. A **refresh** of a surface that already has rows never
  enters a loading state (kept from `console-surface §6`: "a view's declared sources start
  in the loading state and deliberately do not re-enter it on refresh, so live rows are not
  flashed over"); it moves a freshness marker instead.
- **Freshness.** Every surface that reads a source carries a freshness marker: a time, and
  a state (`live`, `stale`, `failed`). It is the same control everywhere and it is not
  decoration; it is the thing that makes H12 possible.
- **Focus.** On every route change focus moves to the new heading (§6.2).
- **Errors never blank data.** A failed read keeps the last rows and marks them stale with
  the failure reason and the last success time (§8).

### H1. First arrival

1. Operator opens `/console`.
2. The shell paints the chrome from local state: the brand, the status slot in
   `Loading system status…` (`console-surface §3`), the local time, the appearance control.
   Nothing else is blocked on the network.
3. The catalogue lands. Home renders:
   - the **needs-you strip**, present only when there is something in it: the count of
     waiting decisions, the count of action items, each a link to `#inbox`;
   - the **app grid**, every app with a declared view plus Settings
     (`console-surface §3`, springboard); each tile is the app's own mark, colour and title;
   - the **status line** fills in: `"<n> services active"`.
4. If the host has never been configured, see H11.

Branches. *Loading:* the grid shows tile-shaped skeletons, not a spinner, because the grid
is the page. *Empty:* no apps registered at all: `No apps discovered.` (kept verbatim from
`console-surface §6`) plus, when the host itself has services but no app registers a view,
one line saying so and a link to Activity. *Error:* the catalogue call fails: the notice
callout kept from today (`console-surface §6`) **plus a Retry control**, which today does not
exist. The rest of Home still renders the places, because Inbox, Activity, Tools and
Settings do not depend on the catalogue. *Stale:* a stale address renders Not found (H13),
never Home.

### H2. Finding an app

1. At Home, the operator scans the grid (2/4/6 columns by width,
   `console-surface §3`).
2. If the app is not visible at a glance, one of two paths:
   - **Keyboard:** `Cmd/Ctrl+K` or `Cmd/Ctrl+P`, type any part of the app's title or id, the
     first result is the app, `Enter` opens it (§6.4).
   - **Filter:** `/` focuses the grid's filter field; typing narrows the grid in place.
3. `Enter` on the focused tile opens the app's start screen (H3).

Branches. *Empty:* the filter matches nothing: `No app matches "<text>".` with a Clear
control, and the grid is not emptied behind it. *Error:* a tile whose app is registered but
whose service is disabled is drawn dimmed with a plain-text marker and its tooltip names the
service; pressing it still opens the screen, which then renders that app's own failure state
(H12). *Stale:* if the catalogue changed since paint, the tile's title is what the app
declares now (the catalogue is re-read on every arrival at Home, never cached across
sessions).

### H3. Entering a screen

1. Operator is on an app's start screen, e.g. `#app/board`.
2. The screen's controls are the app's own: e.g. `/view` segmented control
   (Worktable/Columns) and `/filter` chips (`app-surfaces: board`).
3. A control whose action declares `opens` enters that screen: pressing a row runs
   `board.open`, which enters `task` (`app-surfaces: board`).
4. The address becomes `#app/board/task?taskId=<id>`. The screen's `onEnter`
   (`board.load`) runs once, as the pass after its parameters are written
   (`console-surface §4`).
5. At ≥1024px the parent screen stays beside the current one; below, only the current one
   (`console-surface §4`).

Branches. *Loading:* the entering screen's own reads show their loading state; the parent
pane keeps its rows. *Empty:* a screen whose parameters are absent (`#app/board/task` with no
`taskId`) renders its own empty state and does not run `onEnter`; it names the missing
parameter and offers the parent. *Error:* an `onEnter` failure writes `{ok:false,error}` to
the declared result path (`console-surface §6`) and renders at the control that launched it,
with a Retry that re-runs only that action. *Stale:* see H12.

### H4. Entering a screen by deep link, cold

1. Operator pastes `#app/mantis/conversation?conversationId=qa-2` into a cold tab.
2. The console resolves the app and the screen from the address alone.
3. `onEnter` (`mantis.conversation`) runs with the parameter from the address.
4. **The return control's destination is decided by the view's declaration, not by a stack
   the session never had.** Today: "if this session walked here, `history.back()`, which
   keeps every ancestor's parameters; if the address was pasted, the parent screen the view
   declares" (`console-surface §3`). That behaviour is kept, and the control is relabelled
   (§H5).

Branches. *Error:* the app id resolves but the screen name does not: Not found for the screen,
keeping the address, naming the app's actual screens as links. *Stale:* the app id no longer
resolves because the app was unregistered: Not found, with `The app "<id>" is no longer
registered.` and, when Activity has the record, `It was removed at HH:MM:SS.` linking to that
Activity row.

### H5. Going back (the two Backs, resolved)

Today there are two controls, and they mean different things: the status bar's Home control,
which is the only way out of an app to Home, and an in-view `‹ Back` bar, which returns to
an ancestor screen (`console-surface §3`). Both read as "back" to a user, and the in-view one
is unlabelled as to destination.

Resolution: **they are not two Backs.** They are renamed and separated by what they do, and
each gets its own key.

1. **The return control** (the in-view bar) is labelled with its destination's own title:
   `‹ Board`, `‹ Opened task`, `‹ MCP Gateway`. Never the word "Back". It is drawn only when
   the current screen has an ancestor, as today. Pressing it goes to:
   - the screen the session came from, when the session walked there, preserving that
     screen's parameters; or
   - the declared parent screen, when the address was cold (both kept from
     `console-surface §3`).
   Keyboard: `Alt+Left` (`Cmd+Left` on macOS). `Esc` does the same **only when no layer is
   open**, so `Esc` and `Alt+Left` need not be re-learned.
2. **Home** is a place switch, not a return. It is drawn in the chrome on every route
   except Home, labelled `Home`, and its key is `g h`. It never changes meaning.
3. Below 1024px, where no parent pane is visible, the return control is drawn as a full-width
   row above the screen so its destination is readable without hover.

Branches. *Empty:* at the first screen there is no return control; the only ways out are
Home, the app switcher, and the palette. *Error:* if the parent screen's own read fails, the
return navigation still works and the parent renders its own error state. *Stale:* if the
session walked here and the history entry is gone (a reload after a tab restore), the
declared parent is used and the label is the declared parent's title, so the control never
lies about where it goes.

### H6. Switching apps

Today: "On an app route there is no app switcher at all: the way to another app is Home
first, then the tile" (`console-surface §3`). Three actions to do the commonest thing in the
console is the largest pointer-level friction in the product.

1. On any app route, one action reaches any other app:
   - **Keyboard:** `Cmd/Ctrl+P`, type the app, `Enter`.
   - **Pointer:** an app switcher present in the chrome on every app route, listing every
     app with a view plus Settings, with the current app marked. Its form is the chrome
     designer's decision (§6.7); its **behaviour** is fixed here: one action from any app
     route to any other app's start screen.
2. The destination app's own start screen opens; the address is `#app/<id>`.
3. `g l` returns to the last app the operator was in, so switching away and back is two
   keystrokes.

Branches. *Stale:* an app in the switcher that was unregistered while the tab was open is
removed from the switcher on the next catalogue read, and selecting it before that renders
Not found (H13).

### H7. Configuring an app

Today: Settings only, reached by leaving the app (`console-surface §5`).

1. **In place.** From any screen of the app, a Settings control in the app's own chrome
   opens `#app/<id>/settings`. The same editor renders as at `#settings/<id>`.
2. **From Settings.** `#settings` lists one row per configurable app; selecting a row opens
   `#settings/<app>`. With nothing selected the panel says `Select an app to inspect and
   change its configuration.` (kept verbatim, `console-surface §5`).
3. The editor renders the status callout, then the form generated from the app's schema, with
   each field's server value and each value's source (`console-surface §5`).
4. The operator edits. Typing while not busy raises `Unsaved changes; choose Save and Apply
   or Save for Restart.` (kept, `console-surface §5`).
5. The operator saves: `Save and Apply` (`data-strategy="apply"`) or `Save for Restart`
   (`data-strategy="restart"`). Keyboard: `Cmd/Ctrl+S` and `Cmd/Ctrl+Shift+S`.
6. While a save or apply is in flight the form is disabled and carries `aria-busy="true"`
   (kept, `console-surface §5`).
7. After a save the server's values are reloaded and the note distinguishes success from a
   failed reload (kept, `console-surface §5`).
8. If the save leaves a restart pending, the outcome is an **action item** in Inbox
   (`Configuration saved for <app>. A restart is pending.` with the single action `Apply
   saved configuration`), and `#settings/<app>` shows the `pending` tone.

Branches. *Loading:* `Loading configuration…` (kept). *Empty:* `No configurable apps.` (kept);
for one app, a schema with no fields renders `This app declares no configuration.` and the
Save controls are absent rather than disabled. *Error:* the red note plus error-tone callout
(kept), plus per-field errors: a field whose value fails its schema renders its own message
under the field and Save refuses with focus on the first bad field. *Stale:* an app id that
is not configurable resolves to Not found in place: `"<id>" declares no configuration.` with
a link to `#settings`, instead of today's silent fallback to plain Settings
(`console-surface §2`). A config value changed by someone else since the form loaded: the
form is not silently overwritten; the save is refused and the Conflict sheet renders (§8.3).

### H8. Inspecting an operation

Today: the inspector exists, is reached at `#view/<app>` for an app that only registers MCP,
and has no address of its own; an app with both a view and tools loses its tools
(§1.6, verified in source).

1. `#tools` lists every app that registered operations, from every transport. Today's rule
   that the inspector is only for MCP-only apps is deleted.
2. Selecting an app scopes the list: `#tools/<app>`.
3. Selecting an operation opens it: `#tools/<app>/<operation>`. The panel shows name, title,
   description and input schema; the detail shows the argument form and the Run control
   (`console-surface §7`, kept).
4. Arguments are filled from the schema: string, number, boolean, choice, or raw JSON; empty
   means not supplied; a required boolean starts false; schema defaults appear as
   placeholders (kept, `console-surface §7`).
5. Run. The button shows a loading state and the word `Running` (kept). The result renders as
   JSON or text.
6. Every call from Tools is attributed and audited like any other call: the actor is
   `human:<operator>`, the transport is `console`, and the decision record names it
   (§5.3, §4.6).

Branches. *Empty:* `Select a tool to see what it takes.` and `This tool takes no arguments.`
(kept). *Empty, no operations at all:* `No app has registered an operation.` with a link to
Activity's service list, which is where a disabled service would explain it. *Error:* a
refusal renders as a message beside the form (kept from `console-surface §6`, the red
callout). A protected operation renders its refusal **plus** the verdict path: `This
operation is protected.` with `Ask for a decision`, which raises a decision addressed to the
operator (`class: write.protected`) so that a human pressing Run and an agent calling the
same operation travel one path (§4). *Stale:* the schema is re-read when the operation is
opened; if the app's revision moved since, the panel says `This operation changed at
HH:MM:SS.` and re-renders the form, keeping the arguments the operator already typed.

### H9. Reading Activity

1. `#activity` opens the host record, newest first, live.
2. Filters: actor (`all` / `human` / `agent` / `system`), app, kind (decision, call, config,
   health, failure), and a since-cursor. Filters are address parameters, so a filtered view
   is a link.
3. Rows carry the actor (§5.3), the app, the operation or change, the outcome, and the time.
4. Below the stream, the read-outs kept from today: the service list with enabled state and
   priority, catalogued-app and operation counts, failures, and the warning naming disabled
   services (`console-surface §7`).
5. Selecting a row opens the full record: arguments, reasons, the decision that authorized
   it if any, and the correlation id that ties a human action, the decision and the agent's
   call together.

Branches. *Loading:* `Spinner` (kept). *Empty:* `Nothing reported yet.` and `No failures
observed.` (kept). *Error:* red callout (kept) **plus a Retry** and the last success time.
*Live behaviour, specified because today's is absent:* new rows never shift the scroll
position under a reading human. When the stream is scrolled away from the head, arrivals
accumulate behind a `N new` control; pressing it or `n` jumps to the newest. When the stream
is at the head, rows append in place.

### H10. Answering a decision

The full flow, and the human half of the most important join. §5.1 is the normative version;
this is the path.

1. **The signal.** The operator learns of a decision from whichever of these they are near:
   the Inbox count in the chrome, a browser notification (only for classes marked as waking,
   §1.4 Settings), a DingTalk card (only for classes routed to that channel or raised in that
   conversation, `auxiliary-hosts §1`), or the app's own screen if they are already on it.
2. **Open it.** `#inbox/<decisionId>` renders: the class, who asked, who is blocked, the
   operation and its arguments in full, the gate's reasons, and the deadline with a live
   countdown. Two controls: `Allow` and `Deny`, plus `Hold` (extend, §5.1).
3. **Decide.** The verdict is written once. The first verdict from any surface wins.
4. **Every surface learns.** The Inbox item flips to `answered by <actor> at HH:MM:SS`, the
   app's own screen flips the same way from the same record, a routed channel card is updated
   in place rather than re-sent, and the agent's blocked call returns the verdict.
5. **If it was already answered elsewhere** the controls are disabled, the item names the
   answerer and the source (console, channel, or agent), and the single action is
   `See who decided`.
6. **After answering**, `#inbox` shows the next waiting decision without a navigation, so a
   queue of ten is ten verdicts and no page loads.

Branches. *Empty:* `Nothing is waiting on you.` with a link to Activity. *Error:* if the
verdict write fails, the item returns to `waiting` and shows the failure; it never shows an
optimistic `answered`. *Stale:* the item's countdown reaching zero (expiry) is rendered as a
state change, never as a silent disappearance (§5.1).

### H11. State: nothing is configured yet

1. A host with services but no registered app view, or with no configurable app, renders Home
   with an empty-state pane rather than an empty grid.
2. The pane names what the host does have (its services, from the status line), and offers
   the three things a first operator needs, in order: `Register an MCP server`, `Read the
   host record`, `Configure an app when one is registered`.
3. `No apps discovered.` is kept as the literal for a genuinely empty catalogue
   (`console-surface §6`).

Not a flow: there is no product tour and no onboarding wizard. The operator of this product
is a developer with the host's own documentation.

### H12. State: a source failed

1. A surface reads a source; the read fails.
2. **The rows stay.** The surface keeps the last successful rows and does not blank
   (`console-surface §6`, kept).
3. The freshness marker turns to `failed` with: the last success time, the failure reason,
   the retry schedule, and a `Retry now` control. Today there is no retry affordance for any
   of these (`console-surface §6`, `Absent`); this is the fix.
4. If the failure repeats for longer than the class's attention threshold, it also becomes an
   **action item** in Inbox, so a surface nobody is looking at still reaches the human.
5. Every row that came from the failed read is marked stale in place, once, at the surface
   level; the rows are not each restyled.

Branches. *Empty:* a source that has never succeeded shows the shape of the content it would
have and the reason it has none, not a blank. *Error:* the reason is the source's own error
text, unedited.

### H13. State: the address resolves to nothing (Not found)

Today: no not-found screen exists, an address naming nothing is silently resolved to Home or
Settings, and the bar is rewritten with `replaceState` (`console-surface §6`).

1. An address that does not resolve renders Not found **at that address**, keeping the
   address in the bar and in the shareable link. Nothing is rewritten.
2. The pane states which part failed and what it was looking for: the place, then the app,
   then the screen, in that order, reporting the first part that failed.
3. It names what does exist near it: if the app resolved and the screen did not, the app's
   actual screens; if the app did not resolve, the apps whose ids are nearest, and the
   palette's Go-to.
4. One primary action: `Go to Home`. One secondary: `Search for "<text>"` which opens the
   palette in Go-to mode pre-filled.

### H14. State: your write was refused

The full normative version is §5.4. The human path:

1. The operator is editing a record (a board task, a mantis record, a config field).
2. They press Save. The record's version is not the version it was read at.
3. The write is refused with `version-conflict` (the definition store's own refusal,
   `auxiliary-hosts §3`; the board's outline ops already carry an expected version and re-read
   on refusal, `auxiliary-hosts §1`).
4. **The Conflict sheet** renders, over the screen, without navigating away:
   - what changed, field by field, with the old and the new value;
   - who changed it: the actor (§5.3), with a link to the Activity row;
   - two actions, and only two: `Re-read, keep my changes` (the operator's drafts stay in the
     form; the record's version is taken from the server) and `Take theirs` (the drafts are
     discarded, with a confirmation naming what is discarded).
5. After either action the form is re-armed with the new version, and Save works.

Branches. *The actor was an agent:* the sheet says so plainly, `Changed by agent <name> at
HH:MM:SS`, and links to the call that did it. *The conflict is on the whole record having
been deleted:* the sheet says `Deleted`, and the only action is `Discard my changes and go
to <parent>`. *Two conflicts in a row:* after the second, the sheet additionally offers
`Open this record read-only`, because a hot record being edited by an agent is a real
situation and the operator needs to stop losing.

---

## 3. The agent flows

### 3.0 One path, decided

Today an operation reaches the world two ways, and only one of them is principled:

- `effect-interface` declares one `Operation` and projects it to both transports
  (`toHttpHandler`, `toEffectTools`, `auxiliary-hosts §1`).
- `apps/board/src/hosts/mcp/board-mcp.ts` registers "the same operation list" as MCP tools
  (`auxiliary-hosts §1`), which is the principled path.
- `apps/mantis/src/hosts/mcp/**` registers eleven tools by hand: `mantis_chat`,
  `mantis_conversations`, `mantis_conversation`, `mantis_events`, `mantis_state`,
  `mantis_pending`, `mantis_approve`, `mantis_workspace`, `mantis_workspace_write`,
  `mantis_workspace_update`, `mantis_workspace_delete` (`auxiliary-hosts §1`), which is not.

**Decision: one path.** Every capability is one `Operation` declaration; the HTTP handler and
the tool are two projections of it. The hand-registered mantis tools become operation
declarations. Four consequences follow, and each one is required by a join later in this
document:

1. **One refusal vocabulary.** An agent's refusal and a human's refusal are the same code with
   the same fields, so the console can render an agent's failure and the agent can render a
   human's.
2. **One audit record per call, whatever the transport.** Without this, "who did this?" has no
   single answer and J3 is unimplementable.
3. **One gate.** A protected operation is protected by one rule for every caller, which is the
   precondition for one approval flow (J1).
4. **One naming rule, with its refusal.** Tool names come from `keyOf`/`schemaOf`, whose
   semantics `ToolKey.lean` proves: a dot-free interface id splits a flattened key into
   exactly the pair that built it, and two tool names that sanitize to one served name are
   **refused rather than one being dropped** (`auxiliary-hosts §3`). A hand-registered tool
   list never faces that question; a unified one must answer it, and the answer is refusal.

A tool's served name, its schema, its protection class, its audit shape and its refusal codes
come from the declaration, never from the host that happens to be serving it.

### A1. Discover what it can do

1. The agent connects to the gateway for its principal and calls `tools/list`.
2. Every tool it receives is one it is granted (§4.3). The list is not the host's whole
   surface; it is this principal's reachable surface, and the two differ by design.
3. The `tools/list` result carries the **grant revision** it was computed under.
4. A subsequent change to any grant that touches this principal produces
   `notifications/tools/list_changed` (J2).

Branches. *Empty:* a principal with no grants gets an empty list and no error, plus one
operation `host_status` that is available to every principal and reports the revision, the
host's identity and the count of grants, so an agent can tell "nothing is granted to me" from
"the gateway is broken". *Error:* the gateway unreachable: the transport error surfaces to the
agent client unchanged, and the console shows the same failure as an Activity row and an Inbox
action item. *Stale:* a list computed under a revision that has since moved is still usable;
the agent learns the new revision on its next call result (A6).

### A2. Call a tool and read the result

1. The agent calls a tool with its arguments.
2. The result envelope carries, always: the operation's own result, `revision` (the grant
   revision the call was decided under), `auditId`, and, when a human was involved, the
   `decisionId`.
3. The result is the same value a human sees at the same operation in the Tools place (H8),
   because it is the same operation.
4. Every call writes one audit record with the actor `agent:<principal>` (§4.6).

Branches. *Long call:* a call that takes a long time is not a hang; the host emits progress as
the transport allows, and the console's Activity row shows the call as in flight. *Idle:* the
agent's connection is its own client's concern; the host does not invent a heartbeat.
*Failure:* see A3.

### A3. Hit a refusal

Every refusal an agent can receive, and the single recovery for each. This is the whole list:
an implementation that produces a refusal not on it is incomplete, and one that produces a
refusal without its recovery is broken.

| code | what it means | what the agent gets | the one recovery |
|---|---|---|---|
| `invalid-arguments` | The arguments fail the operation's schema. | The schema, and the paths that failed. | Correct the arguments and re-issue. No retry loop; the same arguments fail again. |
| `grant-denied` | The principal does not reach this tool at all. | The reasons, and the set or binding that would have to change. | Ask the operator for a grant (§4.3). Never retry. |
| `decision-pending` | The call is protected and a human has not answered. | The `decisionId`, the class, and the deadline. | Wait on the decision (A4), or return control to the caller with the decisionId so it can be surfaced. |
| `decision-denied` | A human said no. | The verdict, `answeredBy`, the reasons the gate gave, and the `recovery` action. | Take the recovery, or narrow the request and raise a new decision (A5). |
| `decision-timeout` | Nobody answered before the deadline. | The deadline, and the fact that the class default is deny. | Re-issue only if it is still needed; a re-issue is a new decision with a new id (§5.1). |
| `grant-changed` | The call arrived under a revision that no longer holds. | The old and the new revision. | `tools/list`, then re-issue. Never re-issue blind (A6). |
| `version-conflict` | A write's expected version is not current. | The current version, and the fields that moved. | Re-read, re-apply, re-issue (A7). |
| `not-found` | The object named does not exist. | The id that was looked for. | None; the call was wrong. |
| `service-unavailable` | The app that owns the operation is not serving. | The app id and its service state. | Wait; the console shows the same state as an action item, and the agent may re-issue when the tool is listed again. |
| `egress-unavailable` | The upstream could not be reached. | Which egress was attempted and its policy. | A new call, explicitly, with a new audit id. **Never a silent replay of a write that was already sent** (`CLAUDE.md`). |
| `self-approval` | The principal tried to resolve a decision it raised or is blocked by. | The decision id and the raiser. | Ask a different principal, or ask a human (§5.1). |

### A4. Wait on a decision

Today the console can only send a waited turn (`mantis.send` has fixed `{wait: true}`,
`app-surfaces: mantis`) while the MCP host can fire and let the reply arrive as an event
(`wait: false`, `auxiliary-hosts §1`, `mcp/lifecycle.ts:26`). Both exist for the agent, and
neither is guaranteed for the human.

1. The agent calls a protected tool. The call blocks.
2. The gate raises a decision with `class: call.foreground`, `raisedFor` the agent's principal,
   the full arguments as `subject`, and a deadline (§5.1).
3. The call returns `decision-pending` **or** blocks until the verdict, whichever the caller
   declared. Both are legitimate; the operation declares which. An agent that declares
   blocking gets the verdict as its result; one that declares non-blocking gets
   `decision-pending` immediately and the verdict as an event on the same connection.
4. Either way the decision is answerable from every surface (§5.1), and the agent is not
   required to poll for it.
5. On a verdict, the original call resolves: allowed calls proceed, denied calls return
   `decision-denied`.

Branches. *The human answers from a chat channel:* identical outcome; the answer's source is
recorded as the channel. *The human answers from the console:* recorded as the console. *The
connection drops while blocked:* the decision survives and stays answerable; when the agent
reconnects it learns the verdict either as a pending event or by calling the operation again,
and the second call does not raise a second decision (the gate matches a waiting decision to
its subject).

### A5. Recover from a denial

1. The refusal carries `recovery`, which is a concrete action, not advice: the grant that would
   allow it, the narrower scope, or the operator to ask.
2. The agent's options, in the order the console recommends them to a human:
   - **Narrow and re-ask.** The same tool with a smaller subject raises a new decision. The
     console shows the pattern: `The same subject has been asked 3 times in the last hour.`
   - **Ask for a grant.** The agent has no path to change its own grants. It reports the need
     to the human, and the human's path is the one action the denial offered (§4.4).
   - **Stop.** The refusal is final for this call. A denied decision is not re-asked with the
     same arguments unless the human says so; the third identical ask is a signal, not a retry
     policy.

### A6. Learn that a grant changed

Today an agent finds out by being refused, or by re-reading everything. Neither is acceptable:
the first wastes a call, and the second is a poll loop.

1. Every call result carries `revision`, the grant revision the call was decided under (A2).
2. When a change touches a principal's grants, the gateway sends
   `notifications/tools/list_changed` to that principal's live connections. This is the
   MCP-standard signal, and it is the whole mechanism: the agent does not re-read on a timer.
3. A call that arrives under a superseded revision and whose answer changed is refused with
   `grant-changed` and both revisions. It is **not** answered under the old rules, and it is
   **not** silently retried under the new ones: the agent re-lists and re-issues explicitly, so
   the re-issue is one audited call the human can see.
4. A call that arrives under a superseded revision and whose answer did not change proceeds.
   Revision changes are not interruptions.
5. A narrowing never kills a call already in flight. The in-flight call completes on its own
   terms; the next call is refused. `CLAUDE.md` forbids the alternative for egress
   (an unavailable egress must not implicitly replay a write that was already sent), and the
   same reasoning forbids silently re-deciding an in-flight call under rules that moved.

### A7. Write through an app's store

1. An agent writes to an app's records the same way a human does: through the app's declared
   operations (`mantis_workspace_write` and its neighbours today, `auxiliary-hosts §1`; the
   board's whole operation list, `auxiliary-hosts §1`).
2. Every such write takes an **expected version** when the app's store has one, and is refused
   with `version-conflict` when it is stale (the definition store's own refusal,
   `auxiliary-hosts §3`; board outline ops already send the version the tree was built from and
   re-read on refusal rather than retrying, `auxiliary-hosts §1`).
3. A direct operator write with no agent turn and no approval (`mantis_workspace_write`,
   `auxiliary-hosts §1`) stays direct: it is the operator's own act, attributed to
   `human:<operator>`, and it raises no decision. An agent's write to the same record is
   attributed to the agent and does what its protection class says.
4. The write is visible to a human mid-flow per J5.

### A8. The agent's own UI surface

The `ui-*` packages let an agent author UI (`ui-agent` exposes the canvas ops as tools,
`auxiliary-hosts §1`). Two flows follow from refusals that already exist, and neither is new:

1. **A patch is stale.** `ui-agent/src/index.ts:29` carries the version the caller read so the
   refusal is armed (`auxiliary-hosts §2`). The agent gets `version-conflict` and must re-read,
   exactly as A7.
2. **An extension is refused.** `ui-extension` refuses an extension whose components lack the
   `render` permission, and `ui-sandbox` refuses oversized code, an unknown permission, a
   missing `execute:script`, and undeclared dependencies (`auxiliary-hosts §2`). Each reaches
   the agent as `invalid-arguments` with the specific reason, and reaches the human in the
   ui-host app's own screens.

The one design decision here: **the canvas is drawn by the console's one renderer.** Today
`ui-renderer` and `ui-runtime/src/json-render.ts` are a second renderer for the same node
vocabulary the console's `adapt/` layer renders, which `plan.md` §4 names as the same defect as
four UIs. The flows require one: a canvas an agent authored, a screen an app declared, and a
config form generated from a schema must be drawable by one path, or an agent's canvas will
disagree with the console about what a component means.

---

## 4. The MCP flows

The chain, in the order a request's own journey takes: **registration, exposure, grant,
decision, call, audit**. Each step names the governance rule from `CLAUDE.md` that it must not
break.

### M1. Register a server

1. Operator opens the MCP Registry app: `#app/mcp-registry` → `registry.openRegister` →
   `#app/mcp-registry/register`.
2. Pastes the server's declaration into `/register/declaration` and the server's own token into
   `/register/token` (`app-surfaces: mcp-registry-app`).
3. Presses Register → `registry.register` (`POST /mcp-registry/register`).
4. On success the registry list refreshes and the new server appears with its version, era,
   status and declared `ui://` resources; the token field is cleared.
5. **New in this design:** the declaration is parsed and shown as a preview before Register is
   pressed, so a malformed declaration is refused at the field and never reaches the network.

Branches. *Empty:* `No servers are registered.` with Register as the primary action. *Error, bad
declaration:* the parse error at the field, naming the offending part of the declaration, and
Register stays disabled. *Error, wrong token:* the registry's own refusal at the token field;
the declaration is preserved so the operator retypes only the token. *Error, duplicate server
id:* refused with the existing server named, and the one recovery `Withdraw it first`, linking
to the withdraw screen with the id already filled.

Governance: the registry is an app with its own service. The console opens no port for it and
presents no app's private listener as platform-managed (`CLAUDE.md`: an app may own a port, but
must create and close it and enforce its access policy itself).

### M2. What the gateway will expose

1. `#app/mcp-gateway/topology` reads the servers, the sets, and the agent to set bindings
   (`app-surfaces: mcp-gateway-app`).
2. A tool is exposed only when its server is registered, that server is healthy, and the tool
   is declared by that server's own declaration.
3. The exposed tool set is versioned as a whole, and that version is what a principal's grant
   revision is computed against (§4.3).
4. **New:** each exposed tool names the server it comes from and, when it is not exposed, the
   one reason it is not (unregistered, unhealthy, or undeclared). Today the topology screen
   reads the state; this names the reason per tool, because "why is this tool not in my list"
   is the question the flow actually asks.

Governance: the gateway brokers; it does not become a second registry. Registration lives in
the registry app (M1), and exposure is a projection of what is registered and healthy.

### M3. Which principal may reach which server and tool

1. `#app/mcp-gateway/identities` lists principals: kind (`app` / `user` / `system`, the items
   the issue form offers, `app-surfaces: mcp-gateway-app`), id, display name, status, and their
   tokens.
2. An operator issues a token (`gateway.issueToken`, from `/issue/draft/kind`, `/id`, `/name`,
   `/days`), turns a principal on or off (`gateway.setStatus`), or revokes a token
   (`gateway.revokeToken`).
3. Bindings are principal → set → servers → tools, read on the topology screen.
4. **A grant edit is a change, and it flows through J2.** Before it is saved the console names
   how many principals' tool lists will change; after it is saved, connected principals get
   `notifications/tools/list_changed` and an Activity row names the change, the new revision,
   and the principals affected.

Branches. *The token is shown once.* Today "issues a token (shown once)"
(`app-surfaces: mcp-gateway-app`), written to `/issue/result`. If the operator navigates away
or the list refreshes, the token is gone and the only recovery is revoke and re-issue. **Fix:**
the revealed token is held for the session, not in the screen's transient state: it survives
navigation within the tab until it is copied-and-dismissed or explicitly dismissed, it always
renders with `Copy` and `Dismiss`, and dismissing says what dismissing means (`You will not see
this token again. Revoke and re-issue if you lose it.`). *Revoked while a principal is
connected:* the next call is refused `grant-denied`, and the connection is not silently dropped
mid-call (J2 step 5 applies).

### M4. The access decision (allowed or denied, with reasons)

1. `#app/mcp-gateway` asks the question directly: choose a principal at `/access/agent` and a
   tool at `/access/tool`, press Preview, read `Allowed` or `Denied` and the reasons
   (`app-surfaces: mcp-gateway-app`).
2. **The same function answers the live gate.** A preview and a real call produce one record
   shape, so a preview never disagrees with the call it predicts.
3. **New: the preview is addressable and shareable.**
   `#app/mcp-gateway?agent=<id>&tool=<name>` renders the same answer, so an operator can hand a
   colleague the exact denied case instead of a screenshot.
4. **New: every denial names the one action that would change it**, and pressing it opens the
   binding editor with that principal and that tool pre-selected. A denial that cannot say how
   to fix itself is not a decision, it is a wall (J7).

Order matters, and the flows depend on it: **access is answered first, the gate second.** Access
is a static property of the principal and never waits on a human. The gate may wait on one. So a
call can be grant-allowed and decision-pending at the same time, and the two appear as two
fields in one audit record (§4.6).

### M5. The call

1. An agent calls a tool (A2). The gateway resolves the principal from its token.
2. Access is decided (M4). Denied: `grant-denied`, stop.
3. The gate is consulted. Protected: a decision is raised (J1). Otherwise: proceed.
4. The gateway mints whatever upstream credential the call needs and calls the server over the
   declared **egress policy** for that server: local-first, main-first, local-only, or
   main-only (`CLAUDE.md`).
5. The result returns to the caller (A2) and one audit record is written (M6).

Governance, stated as flow rules:

- **Egress selection and upstream selection are separate layers** (`CLAUDE.md`). The flow
  therefore records both, separately, in the audit record: which egress carried it and which
  upstream answered it.
- **An unavailable egress never implicitly replays a write that was already sent**
  (`CLAUDE.md`). The flow is: refuse with `egress-unavailable`, record the attempt, and let the
  caller decide. The console offers `Send again` explicitly, which is a new call with a new
  audit id.

### M6. The audit record

One record per call, one shape for every transport:

| field | meaning |
|---|---|
| `auditId` | Unique. Referenced by the agent's result envelope and by the console's Activity row. |
| `at` | Time. |
| `actor` | `agent:<principal>` or `human:<operator>`, with the transport (`mcp` / `console` / `http` / `channel`). |
| `operation` | The operation's key, its app, and its declaration revision. |
| `access` | `allow` with the granting binding, or `deny` with the reasons. |
| `gate` | `none`, or the `decisionId` plus how it was answered and by whom. |
| `egress`, `upstream` | The two layers of M5, recorded separately. |
| `outcome` | `ok`, or the refusal code from A3. |
| `correlationId` | Ties a human action, the decision it raised, and the agent's call into one thread. |

`#app/mcp-gateway/audit` reads these newest first (`app-surfaces: mcp-gateway-app`), and
`#activity` reads the same records with the actor and app filters applied (J3). There is one
record store, read two ways. An operator never sees two versions of what happened.

---

## 5. The joins

This is the section the redesign exists for. Seven joins. Each states what happens today, the
design, the invariant an implementation must hold, and the recovery when it fails.

### J1. The approval join: one decision, every surface, and a deadline

**Today.** An approval can arrive in four unrelated places, and each can answer only the
approvals it knows about:

| where | who can answer there | what it can answer |
|---|---|---|
| the console's mantis screen | an operator on the mantis app, from a row press (`app-surfaces: mantis`) | mantis's own gate |
| the console's deck screen | an operator on the deckconsole app, from the consent table (`app-surfaces: deckconsole`) | the deck's own consent |
| a chat card | whoever the card was delivered to (`auxiliary-hosts §1`) | the conversation's protected calls |
| an MCP tool | an agent calling `mantis_approve` (`auxiliary-hosts §1`) | mantis's gate |

A human not looking at the right one cannot answer, and the agent is stuck. There is no
deadline: an unanswered approval is unanswered forever, and nothing escalates.

**The design.** A decision is one object (§1.5) owned by the platform gate. It is raised once
and it is answerable from every surface, with the first verdict winning.

**Where it appears, for each kind of human.**

| the human is | where they see it | what they can do |
|---|---|---|
| at the console, anywhere | the Inbox count in the chrome, always; the full item at `#inbox/<id>` | Allow, Deny, Hold |
| at the console, on the app that raised it | the app's own decision list, from the same record, in the app's own shape | Allow, Deny |
| in a chat channel | a card carrying the decision's own subject, delivered when the class is routed there or the decision arose in that conversation | press the card; the verdict is read only from fields named `action` (`CardVerdict`, `auxiliary-hosts §3`) |
| away from the console but reachable | a browser notification, for classes marked as waking, deep-linking to `#inbox/<id>` | open and answer |
| an agent holding `decision.resolve` | the tool surface: one `decision_resolve` operation, replacing `mantis_approve` | allow or deny, with the principal recorded as the answerer |
| nobody | the deadline | default deny, recorded as `timeout` |

**Deadlines, fixed numbers.** A class without a deadline is a class that hangs forever.

| class | raised when | deadline | on timeout |
|---|---|---|---|
| `call.foreground` | an agent is blocked waiting on this call | 15 minutes | deny |
| `call.background` | the agent fired and continued | 4 hours | deny |
| `write.protected` | any principal tries a protected write | 1 hour | deny |
| `channel.startup` | a channel refuses to start (DingTalk without an owner or a card template, the dws channel without `meUserId`, `auxiliary-hosts §1`) | 24 hours | the channel stays down and the action item stays in Inbox |

**The escalation ladder.** Four steps, and no step is silent.

1. **T+0, raise.** Inbox, the raising app's own list, the routed channel if any, and a browser
   notification for waking classes.
2. **T+0.6 deadline, expiring.** The Inbox item is marked expiring with a live countdown, and a
   routed channel gets a card **update**, not a second card, so a chat does not fill with
   duplicates.
3. **T+deadline, expire.** The decision resolves deny with reason `timeout`, the blocked agent
   receives `decision-timeout` with the class default named, and the item stays visible in Inbox
   for 24 hours marked `expired` so the human sees what they missed, then it drops out of Inbox
   and remains in Activity.
4. **Hold.** An operator may extend a decision once, by one class deadline (1 hour for
   `call.foreground`), recorded with who and when. A second extension requires typing a reason
   into the decision, and the reason is recorded.

**The invariant.** *One decision id, one gate, one verdict, and no surface can decide a decision
from a field the requester controls.* Three concrete rules follow:

- The first verdict wins from any surface. Every other surface flips to `answered by <actor> at
  HH:MM:SS`, and a late second click is answered `Already answered by <actor> at HH:MM:SS`
  rather than re-resolving. This generalizes the behaviour DingTalk already has (duplicate and
  stale card clicks are ignored, `auxiliary-hosts §1`) to every surface.
- **A principal may not resolve a decision it raised or that blocks it.** `CardVerdict` proves
  that a verdict is read only from fields named `action`, so a tool argument spelling "approve"
  cannot decide its own approval and an injected token beside the real click is refused rather
  than obeyed (`auxiliary-hosts §3`). The same rule must hold on the tool transport, where the
  refusal is `self-approval` (A3).
- A decision is never resolved by a timeout **and** a human in the same instant: the resolution
  is a compare-and-set on `state: waiting`, and the loser is told it lost.

**Recovery.** Every denial carries `recovery` (§1.5), and the console renders it as a control,
not as prose: the binding to add, the narrower scope to use, or the operator to notify.

### J2. The change join: a human changes something, and the agent's next call behaves differently

**Today.** Nothing carries the change to the agent. An agent finds out by being refused, or by
re-reading everything on its own schedule. Nothing tells a human which agents their edit just
affected.

**The design.** A grant revision carried on every call, plus a list-changed notification (A6).
The human's side of it:

1. The operator edits a grant, a token's status, or a config value.
2. **Before saving**, the console states the blast radius: `This changes what 3 connected
   principals can reach.`
3. **On saving**, the console writes one Activity row: the change, the actor, the affected
   principals, and the new revision.
4. **Connected principals** receive `notifications/tools/list_changed` at once.
5. **A call in flight is not killed.** It completes on its own terms; the next call is refused
   `grant-changed` if the answer moved. `CLAUDE.md` forbids the alternative for egress (an
   unavailable egress must not implicitly replay a write that was already sent), and the same
   reasoning forbids silently re-deciding an in-flight call under rules that moved.
6. **A refused agent re-lists and re-issues explicitly**, so the re-issue is one audited call
   the human can see, not an invisible retry.

**The invariant.** *No principal is ever answered under rules it has not been told about, and no
change to the rules is invisible to the agent it changes.*

**Recovery.** An agent refused `grant-changed` re-lists and re-issues. A human who needs to know
what changed reads the Activity row from step 3, which links to the principals and to the calls
that were refused.

### J3. The attribution join: an agent acts, a human is watching

**Today.** Activity shows "recent activity, failures" (`console-surface §7`) and the app screens
show their own records, but nothing distinguishes an agent's action from a human's. Mantis's
event ring has tool steps and the board has a change-event log (`auxiliary-hosts §1`, §2), and
neither names an actor.

**The design.** An `actor` on every mutation and every record, everywhere.

1. **Every mutation carries an actor**: `human:<operator>`, `agent:<principal>`, or `system`,
   with the transport it arrived over. That includes the console's own writes, so no row is
   unattributed.
2. **Activity renders the actor as a first-class field** and filters on it. `t` cycles all /
   humans / agents.
3. **An object changed by someone other than the reader, within the last 15 minutes, says so on
   itself**: `Changed by agent build-runner, 40s ago` inline on the row. It clears when the
   reader interacts with that object, not on a timer, because a timer clears exactly when the
   reader finally looks.
4. **The distinction is never colour alone**: a marker glyph plus the actor's name. Colour alone
   fails a colour-blind operator and fails at a glance in a dense cockpit.
5. **Live-ness is per surface, using the intervals the apps already declare**: board 10s; agentd
   10s and 8s; mantis 5s, 5s and 10s; ai-gateway 10s; mcp-gateway 10s on three sources;
   mcp-registry 10s; ui-host 5s on four sources; deckconsole 5s, 10s and 10s; herdr 30s and 5s
   (`app-surfaces.md`). Activity is live on the host's own event cursor.

**The invariant.** *Every change has an actor, and a human never has to guess whether the thing
in front of them moved because of a person or an agent.*

### J4. The 3am join: something fails with nobody watching

**Today.** There is no unread state, no notification, no deadline, and no place a failure
survives to be found. A service can be disabled, a channel can refuse to start
(`auxiliary-hosts §1`), and a source can fail (`console-surface §6`), and the only evidence is a
screen nobody is on.

**The design.** Attention rules, a delivery ladder, and a record that survives.

1. **What qualifies as needing a human** (the attention rules, edited at `#settings`): a
   decision waiting past 60% of its deadline; a decision that expired unanswered; a repeated
   failure of the same source or service; a config in the error tone; a channel refusing to
   start; a principal refused many times in a window; an operation asked repeatedly with the
   same subject.
2. **The delivery ladder**: Inbox always; the routed channel when the class is routed; a browser
   notification for waking classes; the tab badge for everything.
3. **The morning view.** Everything that qualified is still in Inbox, with its own record, its
   own time, and the actor or the failure that caused it. Expired decisions show what was asked
   and what it would have allowed.
4. **The record is durable across a host restart.** This is a requirement, not an observation: a
   decision raised at 3am must be answerable at 9am, and the audit record must outlive the
   process that wrote it. Today the mantis event ring is an in-process structure (`bus.ts:20`
   holds the ring and the subscriber set, `auxiliary-hosts §2`), so this is new work, not a
   consequence of what exists.
5. **The blocked agent was not left hanging.** It received `decision-timeout` with its class
   default named (J1 step 3), so at 9am the operator finds both the unanswered decision and an
   agent that reported a clean refusal rather than a hung call.

**The honest limit.** No platform wakes a sleeping human. The obligation this design accepts is
narrower and it is met: the failure is still there in one place with its own record, the waiting
agent was not silently abandoned, and the human can tell at 9am what happened at 3am without
reading a log.

### J5. The staleness join: a human mid-flow with state that moved under them

Eight stale states, each with what the human sees and the single action that recovers. The rule
for all of them: **the console never silently closes, rewrites, or blanks what the human was
looking at.**

| stale state | what they see | the one action |
|---|---|---|
| a source failed | the rows stay, the freshness marker turns failed with the reason, the last success time and the retry schedule (H12) | `Retry now` |
| a write refused as a version conflict | the Conflict sheet: the field-by-field change, the actor, the Activity row (H14) | `Re-read, keep my changes` or `Take theirs` |
| the decision was already answered elsewhere | the item flips to `answered by <actor> at HH:MM:SS`, the verdict controls disable, the source is named (console, channel, or agent) | `See who decided` |
| the card was clicked twice, or after the verdict | the channel replies `Already answered by <actor> at HH:MM:SS` and does not re-resolve (the rule DingTalk already has, `auxiliary-hosts §1`, generalized) | none needed; nothing changed |
| the address points at something gone | Not found with the address preserved, naming what failed and what exists near it (H13) | `Go to Home` |
| an app was unregistered while the tab was open | Not found naming the app and, when Activity has it, when it went away | the Activity row, then Home |
| a config revision moved under an open form | the save is refused and the editor re-renders the server's current values, keeping the operator's drafts as a diff | `Review and save` |
| a session was already closed (deck) | the session screen states it closed, with who closed it and when, and the transcript stays readable | `Open a new session` |

**The invariant.** *A stale surface tells the truth about being stale, keeps what it had, and
offers exactly one way forward.*

### J6. The identity join: one object seen from two apps

**Today.** Three cases, and none of them links:

- agentd's `registry` screen reads MCP servers and the sets they are grouped in
  (`app-surfaces: agentd`), while the mcp-registry app is the service that holds them and the
  mcp-gateway app is what grants access to them. Three surfaces, one object, no link.
- A board task created in the console's board app and the board's change-event log read in the
  board's own web host (`auxiliary-hosts §1`) are the same record reached two ways.
- A terminal agent in herdr and a fleet agent in agentd (`app-surfaces: herdr-app`,
  `: agentd`) are different objects that a reader will assume are the same, and nothing says so.

**The design.** An **object reference** is a first-class link target: an app may declare that one
of its screens shows an object owned by another app, and the console renders a cross-app link
that resolves to that app's screen for that object. Three applications, in order of importance:

1. An MCP server read anywhere links to `#app/mcp-gateway/topology` filtered to that server, and
   to `#tools/<server>` for its tools.
2. A decision's subject links to the object it is about, in whichever app owns it.
3. Where two apps genuinely hold different objects under similar names, the console says so in
   the object's own header, using the qualified vocabulary of §1.7: `fleet agent` and `terminal
   agent`, `records` and `workspaces`, `conversations` and `sessions`.

**The invariant.** *A name that appears in two apps either resolves to one object with a link, or
names its kind where it appears.*

### J7. The denial join: a refusal that cannot say how to fix itself is a wall

**Today.** A refused operation renders a message beside the form (`console-surface §6`); a denied
access decision renders `Denied` with reasons (`app-surfaces: mcp-gateway-app`); a failed action
writes `{ok:false, error}` to its result path (`console-surface §6`). None of them offers the
action that would change the outcome.

**The design.** Every refusal carries a `recovery` field (§1.5, A3), and the console renders it
as a control. It is a mechanism, not copy: a refusal with no recovery is a defect in the
operation's declaration, checkable at build time.

| refusal | its recovery, as a control |
|---|---|
| `grant-denied` | `Add this tool to <set>`, opening the binding editor pre-filled |
| `decision-denied` | `See who decided`, and `Ask again with a narrower scope` |
| `decision-timeout` | `Ask again`, and `Extend the deadline for this class` linking to Attention settings |
| `version-conflict` | the two Conflict sheet actions (H14) |
| `service-unavailable` | `See the service`, linking to Activity filtered to it |
| `invalid-arguments` | focus the first failing field |
| `egress-unavailable` | `Send again`, an explicit new call (M5) |
| `not-found` | `Search for "<text>"` in the palette |

---

## 6. The keyboard and command model

This section owns what the keyboard **does** and which commands exist. What the chrome looks
like, how the places are drawn, and how the switcher and the shortcut sheet are styled belong
to the chrome design (§6.7).

### 6.1 Where it starts

The console has no keyboard affordances at all today: no `keydown` handler, no hotkey, no
`aria-keyshortcuts`, no focus management anywhere in the client, and no command palette (the
string does not appear in the client sources; a `.shell-menu` CSS rule exists with no
component that renders that class, `console-surface §3`). Its users are developers who live in
it. Everything below is new.

### 6.2 The focus model

1. **A skip link is the first focusable element** and targets the main region.
2. **On every route change, focus moves to the new heading**, which is a real heading element
   with `tabindex="-1"`, for every place, app and screen. This is the missing focus management
   and it is not optional: without it a keyboard user is stranded at the top of the document
   after every navigation.
3. **Focus is never stolen from a form.** A route change caused by an action inside a control
   (a submit, a row press inside a table being edited) leaves focus where the user put it.
4. **Lists use roving tabindex**: `j`/`k` and the arrow keys move within the list, `Tab` leaves
   the list. A list of 200 decisions is not 200 tab stops.
5. **A layer traps focus and restores it**: the palette, the Conflict sheet, a decision sheet, a
   token reveal, and any confirmation. On close, focus returns to the control that opened it,
   not to the document.
6. **One live region** (`aria-live="polite"`) announces, and only these: the route change and
   what it contains (`Inbox, 3 waiting`), a verdict's outcome, a save's outcome, and a source
   failing. It announces nothing else, so it stays worth hearing.
7. **Motion marks arrival only** (`plan.md` §6, `MOTION_INTENSITY: 3`): no focus-driven scroll
   animation, `prefers-reduced-motion` respected, and a newly focused row scrolls into view
   instantly.

### 6.3 The key map

Modifiers are written once: `Mod` is `Cmd` on macOS and `Ctrl` elsewhere.

| keys | scope | what they do |
|---|---|---|
| `Mod+K` | global | Command palette, in command mode (§6.4) |
| `Mod+P` | global | Command palette, in Go to mode |
| `/` | global | Focus the current place's filter or search |
| `?` | global | The shortcut sheet, generated from the key registry |
| `g` then `h` | global | Home |
| `g` then `i` | global | Inbox |
| `g` then `a` | global | Activity |
| `g` then `t` | global | Tools |
| `g` then `s` | global | Settings |
| `g` then `l` | global | The last app you were in, at the screen you left |
| `Alt+Left` (`Cmd+Left` on macOS) | app routes | Return to the parent screen (§2.H5) |
| `Alt+Right` | app routes | Forward one screen, when this session walked there |
| `Esc` | global | Close the top layer. With no layer open, return to the parent screen |
| `Mod+Shift+C` | global | Copy a deep link to exactly what is on screen |
| `Mod+Shift+R` | global | Refresh every source on the current screen |
| `j` / `k` | any list | Next / previous row |
| `Home` / `End` | any list | First / last row (not `g g`, which the `g` chord owns) |
| `Enter` | any list | Open the focused row |
| `o` | Inbox, Activity | Open the underlying object in the app that owns it |
| `x`, `Shift+X` | any list | Select the row, select all visible rows |
| `a`, `d` | Inbox | Focus Allow, focus Deny. `Enter` then confirms. Always two keystrokes |
| `A`, `D` | Inbox | Bulk allow or deny the selection, behind a confirmation naming the count |
| `h` | Inbox | Hold the decision: extend its deadline once (§5.1) |
| `n` | Activity | Jump to the newest row |
| `t` | Activity | Cycle the actor filter: all, humans, agents |
| `f` | Activity | Focus the filter field |
| `Mod+Enter` | any form | Submit the form's primary action |
| `Mod+S` | a config editor | Save with strategy apply |
| `Mod+Shift+S` | a config editor | Save with strategy restart |
| `Esc` | a dirty form | Ask to discard, rather than discarding silently |

Rules that make the map safe, and each one is a rejection of an alternative:

- **No destructive action is one keystroke.** Revoking a token, deleting a task, closing all
  sessions and removing a launcher all require a confirmation that names the object and, where
  a count applies, the count. A verdict is two keystrokes (`a` then `Enter`) for the same
  reason: allowing a protected call is a decision, not a keypress.
- **No bare letter opens anything.** The palette is `Mod`-chorded, so a letter typed into a
  filter is always a letter.
- **No app may rebind a global key.** An app declares actions; the console binds keys. An app
  that wants a key says so in its declaration and the console assigns it from the unclaimed
  set, which is what keeps muscle memory across nine apps.
- **Every bound key is in the registry**, and the shortcut sheet (`?`) is generated from that
  registry. A key that is not in the registry does not exist, so the sheet cannot drift from
  the behaviour.

### 6.4 The command palette

One component, two modes (`Mod+K` and `Mod+P`), one search field. Results are grouped, ranked
by the current context first, and every result is a link the operator could also have pasted:
selecting one navigates.

**Contents, complete.**

| group | entries | what happens on Enter |
|---|---|---|
| Places | Home, Inbox, Activity, Tools, Settings | Navigate |
| Apps | every plan entry: an app with a view, an app with tools only, an app with config only | Navigate to its start screen, or to Tools or Settings when it has no view (§1.6) |
| Screens | the current app's screens; with a space and an app name, any app's screens | Navigate with parameters when they are already known, otherwise to the screen's empty state (§2.H3) |
| Operations | every registered operation, searchable by name, title, and app | Navigate to `#tools/<app>/<operation>` |
| Configuration | every configurable app | Navigate to `#settings/<app>` |
| Decisions | waiting decisions, matched by id, by subject, and by the principal that raised them | Navigate to `#inbox/<id>` |
| Actions | the current app's declared actions | Run it, if it takes no required arguments; otherwise navigate to the screen that holds the control which supplies them, and focus that control |
| Console | cycle appearance; refresh all sources on this screen; copy this screen's deep link; open the shortcut sheet; jump to the newest waiting decision; clear the Inbox count | Do it |

**Rules.**

1. **A destructive command is listed and never executes from the palette.** It navigates to
   its confirmation (§6.3).
2. **An action that needs arguments never runs from the palette.** §2.H3's controls exist for
   a reason, and running a half-filled action from a search box is how a console gets a
   reputation for doing things nobody asked for.
3. **Pasting an address works.** A pasted `#...` address is offered as `Go to <resolved
   title>`, and a pasted text that is not an address is searched, never fetched. The palette
   is a navigator and a runner, never a shell.
4. **Scoped first.** With three keystrokes, the current app's screens and actions are already
   at the top; the operator types a space to reach the rest of the host.
5. **`Esc` restores focus** to the control that opened the palette (§6.2 rule 5).
6. **Every result shows its address** in muted text, so the palette teaches the address space
   rather than hiding it. A console whose users live in it should make its own deep links
   legible.

### 6.5 What every screen gets for free

Every declared screen, without the app doing anything, has: the palette and Go-to; `Mod+Shift+R`
for its sources; `Alt+Left` for its return; `/` for its filter when it has one; focus into its
heading on arrival; and the live region's route announcement. An app declares actions,
sources and controls; it does not declare keyboard behaviour, so two apps cannot disagree about
what `Esc` does.

### 6.6 Discoverability

- The shortcut sheet (`?`) lists the key map of §6.3, generated from the registry, grouped by
  scope.
- The palette lists the action and its key next to it, when it has one.
- Nothing else advertises the keyboard. No tooltip tour, no first-run modal.

### 6.7 The boundary with the chrome design

The chrome designer decides what the switcher looks like, how the Inbox count is drawn, where
the shortcut sheet sits, and how the places are laid out. This section fixes only: that a
switcher exists on every app route and reaches any app in one action; that the Inbox count is
present wherever the chrome is; that the count is a number with an accessible label and not a
colour; and that no chrome affordance is the only path to an action that also needs a key.

---

## 7. The nine apps, flow by flow

For each app: the **entry** flow, the **main loop**, the **exit**, and the dead ends this
design fixes. Ids are as `app-surfaces.md` spells them.

**An honest count first.** All 69 declared actions have a reachable control today (board 6,
agentd 9, mantis 11, ai-gateway 4, mcp-gateway 7, mcp-registry 6, ui-host 6, deckconsole 12,
herdr 8). What is unreachable is not an action but a **capability**: the board's outline
editing, its documents, its calendar and its text filter; the deck's consent policy at session
open and its bulk allow; the gateway's binding edits. Each is named in the app below.

### 7.1 board

**Entry.** Home tile → `#app/board`. The `table` source reads
`/board/api/table?columns=id,title,state,body,agent,waits,failure,parentTitle` every 10s into
`/table` (`app-surfaces: board`). The operator reads the worktable or the columns wall per
`/view` (`SegmentedControl.Root`, Worktable/Columns, `effect-ui-header.ts:22`).

**Main loop.** Filter with the `/filter` chips (All plus five states) → open a row
(`board.open` → `#app/board/task?taskId=<id>`) → `onEnter: board.load` reads
`/board/api/tasks/{taskId}` into `/selected` → edit `/selected/title`, `/selected/body`,
`/selected/state` → Save (`board.save`, PATCH) or Delete (`board.delete`). Create: press New
(`board.new` → `#app/board/new`) → fill `/create/title`, `/create/body`, `/create/state` →
`board.create` (POST `/board/api/tasks` into `/createResult`), which clears the draft fields
and refreshes `table`.

**Exit.** The return control to Board, the app switcher, Home. The board is a loop, not a task
with a finish.

**Dead ends fixed.**

1. `board.create` declares no `opens`, so after a successful create the operator sits on the
   New task form with cleared fields and no sign the task exists (`app-surfaces: board`).
   **Fix:** on success, enter the created task (`#app/board/task?taskId=<new id>`); the draft
   is cleared only after that navigation, so a failure keeps it.
2. `board.delete` declares no `opens` and no clear, so the operator stays in the editor of a
   record that no longer exists, showing its stale values. **Fix:** on success, return to Board
   with a confirmation naming the task; `table` is already refreshing.
3. `board.save` refuses into `/selectedResult` with no version guard, while an agent can write
   the same record over MCP (`auxiliary-hosts §1`: the board's operation list is its MCP tool
   set). **Fix:** every board write carries the version it was read at; a refusal is
   `version-conflict` and renders the Conflict sheet (H14), which is the only place in the
   console where the agent-versus-human race is visible on the object itself.
4. **A whole capability with no reachable control.** The board's own web host has five views
   (columns, tree, table, calendar, documents), a state and free-text filter, a change-event
   log, document create/delete, and outline editing with insert, rename, toggle, delete,
   indent, outdent, move up and move down, each sent against the version the tree was built
   from and re-read on refusal (`auxiliary-hosts §1`). The console's board app declares one
   source, one chip filter, one shape switch and three screens. **Fix:** add a `documents`
   screen and an `outline` screen, bind the text filter to a state path, and link the event log
   to Activity filtered to the board. The outline screen is required by this document
   independently: it is where the version conflict of J5 is a normal working condition rather
   than an exception.
5. The board web host reads agent and run presence per task (`auxiliary-hosts §1`) and the
   console's board has no counterpart. **Fix:** a column on the worktable showing the fleet
   agent bound to a task, with an object reference into agentd (J6).

### 7.2 agentd

**Entry.** Home tile → `#app/agentd`. Two sources: `status` (`/agentd` every 10s into
`/status`) and `launches` (`/agentd/launch` every 8s into `/launches`)
(`app-surfaces: agentd`).

**Main loop.** Read the Agents, Machines and Liveness inventories → open an agent
(`agentd.openAgent` → `agent`, `onEnter: agentd.desired`, GET
`/agentd/desired?agentId={agentId}` into `/inspect/desired`) → read the resolution → plan the
push (`agentd.plan` into `/inspect/plan`) → set `/launch/workdir` and `/launch/prompt` →
`agentd.launch` (POST `/agentd/launch` into `/inspect/launch`), which clears `/launch/prompt`
and refreshes `launches`. A machine is the same shape through `agentd.openMachine`,
`agentd.node` and `agentd.nodePlan`. `agentd.openLaunches` reads the launch queue;
`agentd.openRegistry` reads MCP servers and the sets they are grouped in.

**Exit.** Return to the fleet screen; the launch and plan results stay on the room they were
read in.

**Dead ends fixed.**

1. **`agentd.launch` starts work on a machine and is not gated.** It is the console's most
   consequential write: it asks an agent for a turn on a named machine. `CLAUDE.md` puts
   machine access and agent configuration outside the board's business and inside the agentd
   center, and "the platform owns egress and access governance". **Fix:**
   `agentd.launch` is declared `write.protected`, so it raises a decision (J1) unless the
   operator holds a standing grant for that agent or node. A console that can start agents on
   production machines with one press and no gate is the flaw the approval flow exists to fix,
   and it would be inconsistent to gate an agent's write while leaving the human's ungated.
2. **The registry screen is a dead end into a different app.** It reads servers and sets;
   granting access to them is the mcp-gateway app's job and nothing links the two. **Fix:** J6
   object references from each row to the gateway's binding editor and to `#tools/<server>`.
3. **The plan is not addressable.** `agentd.plan`/`agentd.nodePlan` take their id "from the
   answer they are rendered in" (`effect-ui-agent-room.ts:37`, `effect-ui-machine-room.ts:36`,
   `app-surfaces: agentd`), so a plan cannot be linked to or sent to a colleague. **Fix:** the
   plan result has its own state path and the screen's parameters carry the id, so
   `Mod+Shift+C` on the room yields a link that reproduces the plan.
4. **The screen title `registry` collides with the MCP Registry app.** Renamed to **MCP
   servers** (§1.7).

### 7.3 mantis

**Entry.** Home tile → `#app/mantis`. Sources: `state` (`/mantis/api/state` 5s),
`events` (`/mantis/api/events?after=0` 5s), `workspace` (`/mantis/api/workspace` 10s).

**Main loop.** Read pending decisions and held conversations → open one
(`mantis.openConversation` → `conversation`, `onEnter: mantis.conversation`) → read the
timeline → type `/message/text` → Send (`mantis.send`, POST `/mantis/api/message` with fixed
`{wait: true}`, clearing the draft and refreshing `state`, `events` and the conversation).
Decide: a row press runs `mantis.allow` or `mantis.deny` (POST
`/mantis/api/approval/resolve`), refreshing `state` and `events`. Records: `mantis.openWorkspace`
→ add (`mantis.workspaceAdd` POST), update (`mantis.workspaceUpdate` PATCH, id from
`/workspaceEdit/recordId`), delete (`mantis.workspaceDelete`). Events: `mantis.openEvents`.

**Exit.** Return to the mantis start screen; the conversation stays live and refreshing after
leaving it.

**Dead ends fixed.**

1. **A decision is answerable only from the start screen.** An operator reading a conversation
   when a decision lands has to leave it to answer. **Fix:** J1, plus an inline decision strip
   in the conversation when the waiting decision's `raisedBy` is that conversation.
2. **A waited turn blocks the screen.** `mantis.send` has fixed `{wait: true}`
   (`app-surfaces: mantis`), so a turn that takes minutes holds the interface, while the MCP
   host already supports the non-blocking style (`wait: false`; the reply arrives as an event,
   `auxiliary-hosts §1`). **Fix:** send declares its style; a non-blocking send shows the turn
   as in flight and the timeline as a live source, so the operator can leave and come back.
3. **Record writes have no version guard.** `mantis.workspaceUpdate` takes a `recordId` and a
   replacement text with no expected version (`app-surfaces: mantis`), while the DingTalk host
   and the MCP host write the same store (`auxiliary-hosts §1`). Two writers silently lose one
   edit. **Fix:** records carry a version; update and delete take it; the refusal is
   `version-conflict` and renders the Conflict sheet (H14).
4. **The word `workspace` collides with herdr's.** Renamed to **records**; the screen title
   becomes `Records` (§1.7).
5. **The `events` screen and the host's Activity place are two records of the same host.**
   **Fix:** mantis keeps its own event screen, because the ring is the app's data, and the
   screen carries one link to `#activity?app=mantis` (J6 rule 2).

### 7.4 ai-gateway

**Entry.** Home tile → `#app/ai-gateway`. One source: `models` (`/models` every 10s into
`/models`).

**Main loop.** Read the figures and the provider table → probe one provider with the per-row
Test (`gateway.testProvider`, POST `/models/providers/{providerId}/test` into `/health/result`)
→ read `activity`, `rules` and `endpoints`, each a door into its own screen.

**Exit.** Return to the provider table.

**Dead ends fixed.**

1. **A probe result is not tied to a time.** `gateway.testProvider` declares no `clear` and no
   `refresh` on any action, and neither does any other action in this app
   (`app-surfaces: ai-gateway`). **Fix:** a probe writes a timestamped result on the provider's
   own row, and a result older than the source's interval is marked stale. A green from an
   hour ago read as current is worse than no green.
2. **The app declares no write at all.** All four actions are three doors and a probe, so the
   console cannot change the model plane it presents. If the plane is mutable, it is mutable
   somewhere the console cannot reach. **Flagged as a defect to resolve at the declaration, not
   invented here:** either every mutation the app's HTTP API supports appears as a declared
   operation, or the console is a read-only view of an app it presents as controllable, and it
   must say so on the screen.
3. **The screen named `activity` collides with the console's Activity place.** Renamed to
   **exchanges** (§1.7).

### 7.5 mcp-gateway-app

**Entry.** Home tile → `#app/mcp-gateway`. Sources: `topology` (`/mcp-gateway` 10s into
`/gateway`), `audit` (`/mcp-gateway/audit` 10s into `/audit`), `identities`
(`/mcp-gateway/identities` 10s into `/identities`).

**Main loop.** Choose a principal at `/access/agent` and a tool at `/access/tool` → Preview
(`gateway.previewAccess`, GET `/mcp-gateway/access` into `/access/result`) → read Allowed or
Denied and the reasons. Principals: `gateway.openIdentities` → issue (`gateway.issueToken`
from `/issue/draft/kind`, `/id`, `/name`, `/days`, clearing the id and refreshing
`identities`), turn on or off (`gateway.setStatus`), revoke (`gateway.revokeToken`).
Topology: `gateway.openTopology`. Audit: `gateway.openAudit`.

**Exit.** Return to the access question. This app's loop is a question, not a workflow, which
is why its start screen is the question (correct as designed, `app-surfaces: mcp-gateway-app`).

**Dead ends fixed.**

1. **The access preview is transient.** The answer lands in `/access/result`, screen state, so
   a refresh loses it and it cannot be shared. **Fix:** M4's addressable preview.
2. **The token is shown once and lost on navigation** (`app-surfaces: mcp-gateway-app` says
   "shown once", and the result lives at `/issue/result`). **Fix:** M3's session-held reveal.
3. **A denial cannot say how to fix itself.** **Fix:** J7.
4. **Bindings are read-only.** The topology screen "reads servers, sets, and agent to set
   bindings" while the grant actions are issue, revoke and status only
   (`app-surfaces: mcp-gateway-app`). The console can see the binding that denies a call and
   cannot change it. **Fix:** bindings become editable operations, and every denial links to
   the exact edit (M4 step 4).
5. **The screen named `identities` against the API's `principals`.** Resolved to **principal**
   (§1.7); the screen becomes `Principals`.

### 7.6 mcp-registry-app

**Entry.** Home tile → `#app/mcp-registry`. One source: `registry` (`/mcp-registry` 10s into
`/registry`).

**Main loop.** Read the server list (version, era, status, declared `ui://` resources) →
Register (`registry.openRegister` → `#app/mcp-registry/register` → paste
`/register/declaration` and `/register/token` → `registry.register`, refreshing `registry`) →
Withdraw (row press `registry.openWithdraw` with the `serverId` → paste `/withdraw/token` →
`registry.withdraw`, refreshing `registry`) → Preview (`registry.openPreview` → name
`/preview/serverId` and `/preview/uri` → `registry.preview`, GET `/-/registry/preview`).

**Exit.** Return to the server list, which is where every operation's outcome lands.

**Dead ends fixed.**

1. **The token is the operator's only record of the server and cannot be recovered.** The
   registry holds one token per server id (`app-surfaces: mcp-registry-app`) and withdrawing
   requires pasting it; a lost token has no path except re-registering. **Fix:** a `Rotate
   token` operation, and at registration one plain sentence saying this token is the operator's
   record and is not recoverable.
2. **Preview requires retyping a server id that is on the screen.** `registry.preview` takes
   `{serverId}` from `/preview/serverId` and `{uri}` from `/preview/uri`, both typed
   (`app-surfaces: mcp-registry-app`). **Fix:** the row press carries the id into
   `#app/mcp-registry/preview?serverId=<id>`; the field stays editable.
3. **A declaration is pasted blind and validated after the fact.** **Fix:** M1 step 5.
4. **`registry.preview` reads `/-/registry/preview`.** That is a host-level path carrying an
   app's operation. Under `CLAUDE.md` ("apps declare routes through the SDK, and the host
   registers and revokes them with lifecycle symmetry") this is a boundary defect: the
   operation is the app's and must be declared as such, so the console, the human and any agent
   reach it by one name.

### 7.7 ui-host

**Entry.** Home tile → `#app/ui-host`. Sources: `runtime` (5s), `canvases` (5s), `renderers`,
`components`, `extensions`, `activity` (5s) (`app-surfaces: ui-host`).

**Main loop.** Read the canvas in view and the canvas list → Inspect one canvas
(`uiHost.loadCanvas`, GET `/ui/api/canvas` into `/canvas/loaded`) → pick a renderer at
`/commands/renderer` (`uiHost.setRenderer`, POST `/ui/api/command` with fixed
`{kind: "set-renderer"}`, refreshing `runtime`) and a theme at `/commands/theme` from the fixed
items `default`, `warm-paper`, `dusk` (`uiHost.setTheme`, refreshing `runtime`) → read the
catalog and the announcements.

**Exit.** Return to the canvas list; the renderer and theme choices persist, which is why they
are committed explicitly rather than as live previews.

**Dead ends fixed.**

1. **Two renderers for one node vocabulary.** `ui-renderer`'s HTML and React renderers and
   `ui-runtime/src/json-render.ts` are a second path for what the console's `adapt/` layer
   renders; `plan.md` §4 names this as the same defect as four UIs. **Fix:** one renderer (A8),
   or an agent-authored canvas and an app-declared screen disagree about what a component means
   and the disagreement surfaces as `Unknown component`.
2. **A renderer switch is a host-wide write with no blast radius.** `setRenderer` posts a
   command and refreshes `runtime` (`app-surfaces: ui-host`); every canvas in the host changes
   at once, and any agent streaming into one sees the change without warning. **Fix:** J2's
   blast-radius rule applies: name how many canvases and which agents are affected before
   committing, and write one Activity row.
3. **The two ends of an unresolved component do not meet.** A node whose name resolves to
   nothing is reported in place as `Unknown component: <name>` (`console-surface §6`), and the
   catalog screen is the place that would explain it, with no link. **Fix:** the in-place report
   links to `#app/ui-host/catalog` filtered to the name, and the catalog states per name whether
   the current renderer resolves it.
4. **The screen named `activity` collides with the console's Activity place.** Renamed to
   **announcements** (§1.7).

### 7.8 deckconsole

**Entry.** Home tile → `#app/deckconsole`. Sources: `deck` (`/deck/api/deck` 5s), `launchers`
(`/deck/api/launchers` 10s), `presets` (`/deck/api/presets` 10s).

**Main loop.** Decide pending consent per row (`deck.allow`/`deck.deny`, POST
`/deck/api/consent/{callId}`, refreshing `deck`) → open a session (row press `deck.open` →
`session`, `onEnter: deck.load`, GET `/deck/api/session/{sessionId}/history` into `/opened`,
clearing the draft and the last turn result) → send a turn (`/message/text` → `deck.send`,
refreshing `deck` and the transcript) or retry (`deck.retry`) → close one (`deck.close`) or all
(`deck.closeAll`) → open a new one (`deck.new` → `#app/deckconsole/new` → `/create/kind` from
the deck's served kinds, `/create/sessionId`, `/create/prompt` → `deck.create`, clearing the
id and prompt and refreshing `deck`) → the catalog (`deck.catalog` → read launchers and presets,
remove a launcher with `deck.removeLauncher`, refreshing `launchers`).

**Exit.** Return to the control room; a session keeps running after you leave it, which is the
point of the app and which the screen must say plainly.

**Dead ends fixed.**

1. **Consent is answerable only from the start screen.** **Fix:** J1.
2. **The consent policy cannot be set from the console.** The deck's legacy page opens a
   session with a consent policy (an auto-approve tool list and a default decision), supports
   bulk allow, quick-launches a launcher, and previews a raw config as the unified config plus
   the spawn plan (`auxiliary-hosts §1`); the declarative view's `new` screen has only kind,
   session id and prompt (`app-surfaces: deckconsole`). So the console opens sessions under a
   policy the operator cannot choose. **Fix:** the `new` screen gains the policy fields.
   `plan.md` §5 deletes the legacy page, so if the console does not carry the capability the
   capability is lost rather than moved. This is the clearest case in the nine apps of a
   deletion that would silently remove a product capability.
3. **`deck.closeAll` and `deck.removeLauncher` are destructive with no confirmation.** Both
   take their arguments from a press and act (`app-surfaces: deckconsole`). **Fix:** both
   confirm, naming the count or the label (§6.3).
4. **Opening a session under an existing id is undefined.** `deck.create` takes
   `{kind, sessionId, prompt}`; `sessionId` is optional (`app-surfaces: deckconsole`), and the
   outcome for a collision is not declared. **Fix:** refuse with `session-exists`, naming the
   existing session and offering to open it.
5. **The consent table and mantis's pending list are two shapes for one object.** **Fix:** one
   decision object, two presentations (J1).

### 7.9 herdr-app

**Entry.** Home tile → `#app/herdr-app`. Sources: `workspaces` (`/herdr/workspaces` 30s),
`agents` (`/herdr/agents?tail=12` 5s).

**Main loop.** Read the fleet as cards (lifecycle, pane, cwd, tail) → open one
(`herdr.openAgent` → `agent`, `onEnter: herdr.agentOutput`, GET
`/herdr/agents/{target}/output` with fixed `{source: "recent", lines: 200}`) → read the
terminal, send a message (`/herdr/draft/message` + `herdr.agentPrompt`, clearing the draft and
refreshing `agents`) → Esc or Interrupt (`herdr.agentKeys` with the seeded `/herdr/keys/escape`
`["esc"]` and `/herdr/keys/interrupt` `["ctrl+c"]`) → Focus (`herdr.agentFocus`, refreshing both
sources) → start one (`herdr.openStart` → `#app/herdr-app/start` → `/herdr/draft/startName`,
`/startKind`, `/startWorkspace` → `herdr.agentStart`, clearing the name and refreshing both
sources) → read workspaces (`herdr.openWorkspaces`).

**Exit.** Return to the fleet. The socket connection is the app's, not the console's.

**Dead ends fixed.**

1. **The terminal does not refresh.** `herdr.agentOutput` is an action reading a fixed
   url, not a source (`app-surfaces: herdr-app`), so watching an agent work means pressing
   Refresh forever. **Fix:** while the `agent` screen is open its output is a source on the
   app's own cadence (its sources run at 5s and 30s), and the action remains for a one-shot
   read with different arguments.
2. **A fixed 12-line tail in a fixed url.** The `agents` source is `/herdr/agents?tail=12`
   because "a source fetches a fixed url" (`app-surfaces: herdr-app`), so no view can show more
   and the operator cannot ask for more without opening the agent. **Fix:** the tail length is a
   screen parameter the source url is built from, so `#app/herdr-app?tail=40` is a link.
3. **Keystrokes are a fixed, invisible set.** Esc and Interrupt are seeded values carried as
   action parameters rather than controls (`app-surfaces: herdr-app`), and the result lands at
   `/herdr/result/agentKeys`. **Fix:** keep the curated set and make it first-class controls
   with their results shown in place. Do **not** add an arbitrary key sender: a console that
   also runs agents should not have a general-purpose remote keyboard.
4. **Focus is unobservable.** `herdr.agentFocus` refreshes both sources, so whether focus took
   only becomes apparent when something else changes. **Fix:** the focus result renders inline
   on the card and on the agent screen.
5. **`workspace` collides with mantis's records.** Herdr keeps **workspaces**; mantis renames
   (§1.7).
6. **`agent` in herdr and `agent` in agentd are different objects** and nothing says so.
   **Fix:** the qualified copy (`terminal agent`, `fleet agent`) plus, where they do name the
   same machine, an object reference (J6).

---

## 8. Failure and recovery, collected

Every refusal the system can produce, what the human sees, what the agent sees, and the single
action that recovers. Agent-facing codes are specified in A3 and repeated here only by name.

### 8.1 The human's table

| the refusal | where it comes from | what the human sees | the one recovery |
|---|---|---|---|
| Catalogue load failed | the shell's catalogue call (`console-surface §6`) | The notice callout, kept, **plus a Retry** (today there is none) | `Retry`; the places still render because they do not depend on the catalogue |
| Status line failed | `GET /-/status` (`console-surface §3`) | `Status unavailable`, kept, plus the last time it was known | Retry on the freshness marker |
| A mounted surface threw | any app's view (`console-surface §6`) | A callout above the mount, kept, **now scoped to that pane only** so the rest of the console survives | `Retry`, and `Reload this app` |
| An unknown component name | a spec node (`console-surface §6`) | `Unknown component: <name>` in place of that node, kept, plus a link to `#app/ui-host/catalog` filtered to the name (§7.7) | Fix the declaration, or register the component |
| A source failed | any source (`console-surface §6`) | The rows stay, the freshness marker goes failed with the reason, the last success time and the retry schedule (H12) | `Retry now` |
| A tool refused | the inspector (`console-surface §6`) | A message beside the form, kept, plus the operation's `recovery` (J7) | The recovery control |
| An action failed | `{ok:false, error}` at the result path (`console-surface §6`) | At the control that ran it, kept, plus the recovery | Re-run, or the recovery |
| Activity failed to load | the Activity read (`console-surface §6`) | A red callout, kept, plus a Retry and the last success time | `Retry` |
| A config save failed | `POST …/config/…` (`console-surface §5`) | The red note, kept, the error-tone callout, and the server's own message | `Save` again after fixing the named field |
| A config reload failed after a successful save | `console-surface §5` | The distinct reload-failed note, kept | `Reload` |
| A config is in the error tone | the server's state (`console-surface §5`) | The `error` tone, kept, plus an Inbox action item | Open the app's config, where the failing field is marked |
| A restart is pending | the server's state (`console-surface §5`) | The `pending` tone, plus an Inbox action item | `Apply saved configuration` |
| A write refused as a version conflict | the store's own refusal (`auxiliary-hosts §3`) | The Conflict sheet (H14) | `Re-read, keep my changes` or `Take theirs` |
| A decision was answered elsewhere | the gate (J1) | `answered by <actor> at HH:MM:SS`, controls disabled | `See who decided` |
| A card was clicked twice | the channel (`auxiliary-hosts §1`) | The channel replies `Already answered by <actor> at HH:MM:SS` | None; nothing changed |
| A protected call was denied | the access engine (M4) | `Denied` with reasons, kept, plus the one fixing action (J7) | `Add this tool to <set>` |
| An egress was unavailable | the call path (`CLAUDE.md`) | The refusal, the egress and its policy, and the fact that nothing was replayed | `Send again`, an explicit new call |
| A service is disabled | the host (`console-surface §7`) | The warning naming disabled services, kept, plus an Inbox action item | Open the service in Activity |
| A channel refuses to start | DingTalk without an owner or a template; dws without `meUserId` (`auxiliary-hosts §1`) | An Inbox action item naming the missing setting (today: a startup refusal and a stderr line) | Open `#settings`, where the field is named |
| An address resolves to nothing | the route (`console-surface §6`) | Not found, address preserved, what failed named (H13) | `Go to Home`, or `Search for "<text>"` |
| A registry registration was refused | the registry app | At the field, with the declaration preserved | Fix the field |
| A server's token is lost | the registry app | At the withdraw field, with no path forward today | `Rotate token` (new, §7.6) |
| An extension lacks a permission | `ui-extension` (`auxiliary-hosts §2`) | The refusal naming the missing `render` permission | Fix the extension's manifest |
| A sandbox request was refused | `ui-sandbox` (`auxiliary-hosts §2`) | The refusal naming which rule (size, permission, `execute:script`, dependency) | Fix the request |
| A canvas patch was stale | the definition store (`auxiliary-hosts §2`) | The Conflict sheet, in the ui-host app's own shape | Re-read and re-apply |
| A canvas node was refused | the definition store: duplicate node, children, nesting, required props (`auxiliary-hosts §2`) | In place on the node | Fix the node |

### 8.2 The agent's table

The whole list is A3, and the recovery column there is normative. Two properties that make the
two tables one mechanism rather than two: **the codes are the same codes** (so a human reading
an agent's failure and an agent reading a human's failure read the same thing), and **every
refusal carries `recovery`**, which the console renders as a control (J7) and the agent receives
as an action.

### 8.3 The Conflict sheet, specified once

It is referenced by four rows above and by H14, so it is specified once here.

- **Trigger.** A write whose expected version is not current (`version-conflict`), from any
  store that carries versions.
- **Content.** The object; the actor and time of the change with a link to its Activity row;
  the field-by-field old and new value for the fields that moved; and, when the actor was an
  agent, the call that did it.
- **Actions, exactly two** (plus `Open read-only` after a second conflict on the same record,
  H14): `Re-read, keep my changes`, and `Take theirs`.
- **Never**: an automatic merge, a silent last-writer-wins, or a silent discard of the
  operator's drafts. A console that merges two edits of a task body has made a decision on the
  operator's behalf that it cannot explain afterwards.
- **Concurrent case.** If someone else resolves the conflict first, the sheet flips to
  `Already resolved by <actor> at HH:MM:SS` with `See who decided`, the same rule as a decision
  (J1).

---

## 9. What the flows require of the implementation

Mechanisms, not code. Each is named with the flow that fails without it.

1. **A decision store.** Decisions with stable ids, classes, subjects, reasons, deadlines and a
   single verdict, durable across a host restart. Without it, J1, J4 and A4 do not exist.
2. **An action-item kind, distinct from a decision.** Items with one recovering action and no
   verdict, so "a restart is pending" and "a channel will not start" reach a human. Without it,
   H11, H12 and J4 have nowhere to land.
3. **A channel router.** One decision, delivered to Inbox always and to a channel when the
   class is routed; card updates rather than duplicates; and a verdict read only from fields
   named `action`. Without it, J1's multi-surface answer is a claim rather than a mechanism.
4. **An actor on every mutation and every record**, with the transport, including the console's
   own writes and including the console's own identity as a principal. Without it, J3 is
   unimplementable, and the console cannot answer "who did this?" even about itself.
5. **An expected version on every editable record, and one conflict presentation.** Without the
   version, J5's most common case cannot be detected; without the one presentation, each app
   invents its own and the operator learns a different conflict each time.
6. **A principal-scoped grant revision, carried on every call, plus a list-changed
   notification.** Without it, J2 degrades to refusal-by-surprise and to agents polling.
7. **One operation declaration projected to both transports**, with the tool name derived by
   `keyOf`/`schemaOf` and the sanitization collision refused rather than dropped. Without it,
   the refusal vocabularies, the audit records and the gate diverge, and §3.0's four
   consequences fail one by one.
8. **One refusal vocabulary with codes and a mandatory `recovery` field**, checkable at build
   time. Without the build-time check, J7 decays into prose that some operations have.
9. **A contribution registry for the places.** Inbox, Activity, Tools and Settings merge
   contributions from apps, while the console holds no list of app ids and no per-app knowledge
   (`console-surface §1`). This is the mechanism that keeps the new IA from becoming the old
   special-casing.
10. **A route resolver with an explicit not-found outcome**, which preserves the address and
    never rewrites it. Without it, H13's defect returns the moment someone types a stale link.
11. **A command registry**, single-sourced for both the key bindings and the shortcut sheet.
    Without it, the sheet drifts from the behaviour (`console-surface §3` records that the one
    `.shell-menu` rule today has no component at all).
12. **Focus management on route change, with a live region** for four announcements only.
    Without it, the console is unusable from the keyboard no matter how many keys are bound.
13. **A live event cursor per surface**, reusing the interval each source already declares, and
    a scroll rule that never moves a reading human. Without it, J3's "a human is watching" case
    is a table that jumps.
14. **A session-held reveal for one-time values** (a token), surviving navigation within the
    tab, and expiring on dismissal rather than on a refresh. Without it, M3's token is lost to
    a source refresh.
15. **An egress policy read from the platform, never editable from an app's screen, and never
    replayed on failure.** The flows record which egress carried a call and which upstream
    answered it, as two fields (`CLAUDE.md`).
16. **A durable record that outlives the process.** J4's morning view and M6's audit record are
    the same store read two ways; the mantis event ring is in-process today
    (`auxiliary-hosts §2`), so this is new work.

---

## 10. Scope: what this document does not specify

- **What the chrome looks like**: layout, spacing, tokens, colour, the shape of the app
  switcher, the Inbox count's design, the shortcut sheet's presentation. Owned by the chrome
  design. What the keyboard **does** and which commands exist is §6's.
- **The rendering contract**: `console-surface §4` (spec, the `adapt/` conversion layer, the
  `@json-render` renderer) is kept unchanged, with one edit: one renderer for the canvas, not
  two (A8).
- **The design system and the dials**: `plan.md` §6 (`DESIGN_VARIANCE: 3`,
  `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 7`, Radix Themes locked to one appearance, Geist, a
  single restrained accent) are fixed and this document adds no aesthetic decision to them.
- **Http and transport detail**: how a place is served, how a route is registered, how a
  channel adapter is wired. `plan.md` §5 and the SDK's own contracts own those.
