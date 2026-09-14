# The console surface

## 1. What the console is

The console is the host's own web shell, served as one HTML document at `/console` whose single
mount root (`#console-root`, `apps/effect-server/src/console-page.ts:29`) is filled by a React
bundle. Its job is to present every app a running effect-agent host has — an app that declares a
view, an app that only registers MCP tools, an app with configuration — as one product: a
springboard to open apps, a place to enter and walk an app's screens, one Settings surface to read
and change configuration, an inspector to call MCP-only apps' tools, and a read-out of what the
host reports about itself. It holds no list of app ids and no per-app knowledge: every app names
and draws itself through the catalogue (`apps/effect-server/src/console/apps-catalogue.ts:1-9`,
`apps/effect-server/src/client/console-plan.ts:11-22`). Its users are operators and developers of
the host — the people who wire apps up, configure them, and need to see what a tool actually
returns.

## 2. The route grammar

The URL hash is the only route record; React state is derived from it, so a click, a pasted link
and the browser's back button all take one path (`apps/effect-server/src/client/console-nav.ts:1-7`,
`console-route-hooks.ts:31-34`).

Every address the console answers, resolved in this order by `parseConsoleHash`
(`console-plan.ts:90-97`):

| Address | Rule | Renders |
|---|---|---|
| `""` or `"#"` | exact | Home springboard (`console-plan.ts:91`) |
| `#settings` | exact | Settings; no app selected (`console-plan.ts:91`) |
| `#settings/config/<id>` | `/^#settings\/config\/([^/?]+)/` (`console-plan.ts:92`) | Settings with that app's editor; falls back to plain Settings if the id is not in the plan with `hasConfig` |
| `#config/<id>` | `/^#config\/([^/?]+)/` (`console-plan.ts:93`) | Same as above — the one-time spelling of a link to an app's configuration; resolves to the Settings page that holds the form (`console-plan.ts:81-89`). Not anchored to end, so `#config/daemon/deep?x=1` resolves identically (`src/client/test/console-plan.test.ts:51`) |
| `#view/<app>` | `DESTINATION` = `/^#view\/([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/` (`console-plan.ts:69`) | The app's surface. The app id stops at the first `/`; the entry must be in the plan with `hasView`, else Home |
| `#view/<app>/<screen>` | same regex, group 2 | The app's surface with that screen on top. Empty screen (trailing `/`) means "no screen" |
| `#view/<app>/<screen>?<name>=<value>&…` | same regex, group 3, parsed by `URLSearchParams` | Same, with the screen's parameters (`console-plan.ts:73-79`). Parameters are strings — a number arrives as its digits |
| anything else | no match | Home (`console-plan.ts:94`) |

Rules that apply to all of them: ids and screen names are `decodeURIComponent`-decoded with a
fallback to the raw value when decoding throws (`console-plan.ts:70`, `92-96`); an id that does
not resolve to a declared surface resolves to Home (for `#view/`) or Settings (for the two config
spellings) rather than to an error (`console-plan.ts:92-96`). Writing the address is the inverse
(`hashOf`, `console-nav.ts:20-28`): `#`, `#settings`, `#settings/config/<id>`,
`#view/<id>[/<screen>][?query]`. Navigating to the address already shown does nothing — no
duplicate history entry (`console-nav.ts:40-45`). A stale address is rewritten with
`replaceState`, not pushed, once the catalogue has landed (`console-nav.ts:73-79`).

`appRoute(id)` maps a tile to its destination, with `settings` special-cased to
`{kind:"settings"}` (`console-plan.ts:99-100`). The shell special-cases one more id:
`#view/activity` renders the built-in Activity surface rather than mounting an app
(`console-shell.tsx:59`).

Two route families decide the frame (`console-shell.tsx:40-41`): `home`, `settings`,
`settings-config` are *document* routes — `Section` + `Container`, as tall as their content. A
`view` route is an *app* route — it fills exactly the area the chrome leaves, and the surface
decides which of its own parts scroll (`console-shell.tsx:81-86`, `console-shell.css:17-29`).

## 3. The chrome

- **Status bar** (`console-status-bar.tsx`). A brand strip across the top, always drawn. It
  carries: the Home button — an icon button labelled "Home" that navigates to `#`, drawn only
  when not on Home (`:34-36`); the title of the open surface, which is the app's declared title
  or "effect-agent" (`console-shell.tsx:43-47`); the host status line; the local time, refreshed
  every 30 s (`:31-32`, `:40`); and the appearance control. The status line is `"<n> services
  active"` from `GET /-/status`, or "Status unavailable" when that call fails
  (`console-boot.ts:11-18`).
- **Appearance control** (`console-status-bar.tsx:9-15`). One button, `◐`, whose tooltip is
  `Appearance: Follow system | Light mode | Dark mode`. Pressing it cycles system → light → dark
  (`theme-runtime.ts:6`, tested at `src/client/test/theme-runtime.test.ts:5`). The choice persists
  in `localStorage` under `effect-theme` (`theme-runtime.ts:8`, `:17`) and is stamped on the
  document element before first paint so there is no flash (`console-page.ts:16`). Every mount
  point renders inside one `ConsoleTheme` (accent jade, gray gray, radius large,
  `console-theme.tsx:20-23`), so the appearance is one decision everywhere.
- **Springboard** (`console-home.tsx`). Home is a grid of app tiles, 2/4/6 columns by width
  (`:16`), each tile the app's declared mark, colour and title (`console-app-icon.tsx:17-29`).
  From a tile the user reaches that app's view — or, for the id `settings`, the Settings surface.
  Reachable from Home: every app with a view, plus Settings.
- **Dock** (`console-dock.tsx`). A floating launcher, `nav[aria-label="Apps"]`, drawn only on
  document routes that are not Home (`console-shell.tsx:86`) — in practice, under Settings. It
  lists every plan entry with `hasView` except `settings`, then a separator, then a fixed Settings
  entry (`console-dock.tsx:42-50`). From it the user reaches any app's view and Settings; the
  current entry is marked with `aria-current="page"` and a dot (`:34`, `console-shell.css:78-82`).
  Under Home there is no dock — the springboard is the list at full size. On an app route there is
  no app switcher at all: the way to another app is Home first, then the tile
  (`console-dock.tsx:5-7`).
- **Back affordances.** There are two, and they mean different things. (a) The status bar's Home
  control, the only way out of an app to Home (`console-status-bar.tsx:17-25`). (b) Inside a view,
  a `‹ Back` bar above the current screen, drawn only when the screen has an ancestor
  (`effect-ui-screen-panes.tsx:36-40`). What Back does is the host's answer: if this session
  walked here, `history.back()`, which keeps every ancestor's parameters; if the address was
  pasted, the parent screen the view declares (`effect-ui-runtime.tsx:69-74`, `console-stack.ts:8-22`).
  At the first screen there is no Back; the way out is Home.
- **Screen menu** (`effect-ui-screen-menu.tsx`). When the host had to read an app's screens off
  its layout rather than being told them (`view.screens === undefined` and more than one screen,
  `console/view-route.ts:37`), those screens have no control in the view, so the host draws a row
  of buttons under the first screen naming each of them (`:24-29`). A declared screen has its own
  control and no menu.
- **Keyboard affordances: none.** No `keydown`/`onKeyDown` handler, hotkey, `aria-keyshortcuts` or
  focus management exists anywhere in the client. **There is no command palette** — the string
  does not appear in the client sources. A `.shell-menu` CSS rule for a floating round button
  exists (`console-shell.css:100-108`, `:116`) but no component renders that class, so no such
  control exists today.

## 4. The rendering contract

A view is declared by the app as a tree of nodes (`component` name plus props) on an
`EffectUiView`. The path from declaration to DOM has three named steps:

1. **Spec** — the app's declaration, lowered by the host. `viewToJsonSpec` turns one screen's
   nodes into a JSON spec, per screen rather than once for the view, because a spec's element ids
   are a flat namespace and two screens whose first node has no id would both be `"0"`
   (`console/view-route.ts:1-17`). Config forms are lowered the same way by `formToJsonSpec` from
   the app's config schema (`console/config-route.ts:16`). Payloads carry
   `{id, title, parent?, onEnter?, spec}` plus `screens`, `menu`, `actions`, `sources`
   (`effect-ui-runtime-types.ts:10-34`).
2. **Lowering/adaptation — ours.** Everything under `apps/effect-server/src/client/adapt/`.
   `catalog.ts` resolves a component name by walking `@radix-ui/themes`'s own exports, dotted for
   subcomponents (`"Card"`, `"Table.Row"`), rejecting namespaces and non-components (`:29-51`).
   `contract.ts` is the whole conversion idea: a node's content arrives on the prop `value` unless
   the node declares children, and every other prop is an attribute (`:1-25`, `:44-56`).
   `controls.ts` names the components that hold a live value and on which prop, and derives the
   change handler from the prop name (`:32-54`). `render.tsx` decides one of three shapes per name
   — *control* (writes back to view state), *press* (`Button`/`IconButton`), *display* — and
   caches one renderer per name for the life of the page, because a fresh component type per draw
   makes React unmount and lose focus mid-keystroke (`:69-95`). `registry.ts` builds one registry
   per view from the names the spec actually uses; a host-supplied component wins over the
   library's for its name (`:43-44`, tested at `src/client/test/adapt-registry.test.tsx:8`).
   `unresolved.tsx` is the single report for a name nothing resolves. `preview.tsx` is the one
   component in a view that is ours: it renders a `ui://` resource as a `kind`-chosen sandboxed
   iframe, image or text (`:36-47`).
3. **Renderer — third-party.** The spec is drawn by **@json-render** — `Renderer` and
   `JSONUIProvider` from `@json-render/react`, with state from `createStateStore`/`StateStore` in
   `@json-render/core` (`effect-ui-runtime.tsx:17`, `effect-ui-screen-panes.tsx:21`,
   `effect-ui-view-state.tsx:14`); versions `^0.20.0`, `packages/ui-renderer/package.json:8-9`.
   The design system the names resolve against is **@radix-ui/themes** (`^3.3.0`).

One runtime wraps it (`effect-ui-runtime.tsx`): one registry across all screens of the view
(`:53-56`), one store seeded from the *view's* state plus `_nav` and `_sources` (`:57`,
`effect-ui-view-state.tsx:28-32`), the current screen chosen from the address bar and nowhere else
(`effect-ui-screen-nav.ts:32-38`), the current screen's `onEnter` run once per arrival as the pass
after its parameters are written (`effect-ui-screen-entry.ts:27-38`), and panes showing the parent
screen beside the current one at ≥1024px, only the current one below
(`effect-ui-screen-panes.tsx:51-68`, `console-shell.css:54-57`).

## 5. The config surface

Settings is the console's config surface: one row per configurable app, one editor beside it
(`console-settings.tsx:9-38`). Selecting a row navigates to `#settings/config/<id>`; with nothing
selected the panel says "Select an app to inspect and change its configuration."

The editor (`config-surface.tsx`) is a status callout followed by a form generated from the app's
schema. The callout's wording and tone come from the server's state, never an optimistic guess
(`config-state.ts:4-20`): `active` — "Configuration is active"/"Reload reads the persisted server
values."; `pending` — "Saved · restart or apply pending", plus an "Apply saved configuration"
button; `error` — "Configuration error". The revision is shown when the server sends one (`:18`).
`GET /console/api/config/<id>` returns
`{kind:"config", id, ok, pendingRestart, revision?, schema, value, sources, jsonSpec}`
(`console/config-route.ts:14-19`). Writes are `POST` with
`{override, strategy: "apply"|"restart", unset}` (`:27-33`) or `POST …/apply` for apply-only
(`:21-24`).

`data-*` markers are the read-back contract between the generated form and the code that saves it
— the form mounts outside React, so its buttons and values are read out of the DOM:

- `data-ui="input"`, `data-path` (the field's path in the config object), `data-kind` (schema
  kind), `data-node` (spec element id) — emitted on every generated field
  (`adapt/config-fields.tsx:37`); the reader queries `[data-ui="input"][data-path]` and walks the
  DOM to rebuild the value (`config-react-mount.tsx:32`).
- `data-strategy` = `apply`|`restart` on a save button; the shell's click listener reads it
  (`config-surface.tsx:41-42`, `adapt/config-fields.tsx:62-69`).
- `data-array-action` = `add`|`remove`, with `data-array-node` (the array's element id) and
  `data-array-index` (row index) (`adapt/config-fields.tsx:65-66`), consumed by the array handler
  (`config-react-mount.tsx:30`).
- `data-ui-role="array"` marks the array container (`adapt/config-fields.tsx:57`); row containers
  carry `arrayRow: true` (`config-array.ts:17`).

Array add/remove (`config-react-mount.tsx:16`, `:30`): every array row is lowered with the path
`<arrayPath>.<index>`, and the host appends one "Remove" button per row plus one "Add item"
button. Add appends a new row lowered from the array's `itemSchema` (offered only when the element
carries one), then re-renders. Remove deletes the row's element subtree, drops it from the array's
children, and re-indexes every remaining row's `fieldPath` and every Remove button's `arrayIndex`
(`config-react-mount.tsx:15`, `config-array.ts:21-29`). Clearing a field that was present on load
is an explicit deletion: `unset` is the top-level keys present at load and absent from the
read-back (`config-edits.ts:6-10`).

While a save or apply is in flight, every input, select, textarea and button in the form is
disabled and the container carries `aria-busy="true"` (`config-session.ts:21-24`). Typing while
not busy raises the hint "Unsaved changes; choose Save and Apply or Save for Restart."
(`config-surface.tsx:9`, `:44`). After a save the server's values are reloaded, and the note
distinguishes "Operation succeeded; saved server values were reloaded." from the reload-failed
variant (`config-session.ts:51-55`).

## 6. Interaction states that exist today

**Handled.** *Loading*: shell status "Loading system status…" (`console-shell.tsx:65`); Activity
shows a `Spinner` (`console-activity-view.tsx:60`); config note "Loading configuration…"
(`config-surface.tsx:25`); a view's declared sources start in the loading state and deliberately
do *not* re-enter it on refresh, so live rows are not flashed over (`effect-ui-view-state.tsx:28-32`,
`effect-ui-source-runtime.ts:36-37`); a tool call shows the button loading and the word "Running"
(`inspector-detail.tsx:55`). *Empty*: "No apps discovered." (`console-home.tsx:15`); "No
configurable apps." (`console-settings.tsx:22`); "Select an app to inspect and change its
configuration." (`console-settings.tsx:35`); "Select a tool to see what it takes."
(`inspector-panel.tsx:39`); "This tool takes no arguments." (`inspector-detail.tsx:49`); "Nothing
reported yet." / "No failures observed." (`console-activity-view.tsx:27-37`); "Select a resource
to preview." (`adapt/preview.tsx:43`). *Error*: catalogue failure → a red callout above the
surface (`console-shell.tsx:69`, `:77`); status line degrades to "Status unavailable"
(`console-boot.ts:15-16`); a mounted surface that throws → red callout above the mount
(`console-mounted.tsx:34`); an unknown component name → "Unknown component: <name>" in place of
that one node (`adapt/unresolved.tsx:19-23`); config failure → red note plus error-tone callout
(`config-surface.tsx:74`, `config-state.ts:13`); a tool refusal → red callout beside the form
(`inspector-result.tsx:26-28`); a failed action writes `{ok:false, error}` to the action's
declared result path (`effect-ui-action-runtime.ts:44-46`); a failed source keeps the previous
rows and records `state:"failed"` (`effect-ui-source-runtime.ts:45-48`); Activity error → red
callout (`console-activity-view.tsx:61`). *Disabled*: the config form lock during save
(`config-session.ts:22`) and per-field `readOnly`/`disabled` from props
(`adapt/config-fields.tsx:39`,`:41`,`:45`).

**Absent.** There is no not-found screen: an address naming nothing is silently resolved to Home
or Settings and the bar is rewritten (`console-plan.ts:92-96`, `console-nav.ts:73-79`). There is
no error boundary anywhere in the shell tree. There is no retry affordance for a failed catalogue,
status line, Activity load or mounted surface. There is no first-paint skeleton — loading is a
spinner or a sentence. There is no offline or connection-lost state. There are no keyboard states
and no focus management on route change.

## 7. What a user can do — capability list

- Open the console at `/console`.
- See every app the host has, as a springboard of tiles.
- Open an app's declared view from a tile or from the dock.
- Open Settings from a tile or from the dock.
- See which app is currently open.
- Enter a named screen of an app by address.
- Pass parameters to a screen through the query string.
- Go back one screen, with the walked history's parameters preserved.
- Go back to the declared parent screen after pasting a link cold.
- Reach Home from any app screen.
- Use the browser's Back and Forward buttons as navigation.
- Paste or share a deep link to a screen with its parameters.
- See a stale address corrected to the nearest place that exists.
- Switch between apps from the dock.
- Read the host's status line and the local time.
- Cycle the appearance between system, light and dark, and keep it across reloads.
- Press a control in a view and have the value written back to view state.
- Press a button that runs an action, a read, an action that enters a screen, or both.
- See an action's answer or refusal written at the control that caused it.
- Have consumed drafts cleared and affected reads refreshed after a successful call.
- See declared sources refresh on their own interval.
- Preview a `ui://` resource as a sandboxed page, an image or text.
- Use the root screen's menu to reach screens no control in the view opens.
- Read a configurable app's configuration field by field, with the server's values and each
  value's source.
- Read the configuration's status tone, revision and whether a restart or apply is pending.
- Change configuration fields.
- Add and remove rows in a configuration array.
- Save configuration with strategy "apply".
- Save configuration with strategy "restart".
- Apply already-saved configuration explicitly.
- See an unsaved-changes hint after typing.
- Have the form locked while a save or apply is in flight.
- See save success or failure wording and the reloaded server values.
- Inspect an MCP-only app's tools.
- Select a tool and read its name, title, description and input schema.
- Fill a tool's arguments from its schema (string, number, boolean, choice, or raw JSON; empty
  means not supplied; a required boolean starts false; schema defaults appear as placeholders).
- Run a tool and read its result as JSON or text.
- Read a tool's refusal as a message beside the form.
- Read Activity: service list with enabled state and priority, catalogued-app and operation
  counts, recent activity, failures, and a warning naming disabled services.
- See a node whose component name resolves to nothing reported in place rather than dropped.
