# Agent parity + observation (mirror / replay)

Principle: **a person can see and operate the world the agent sees, with exactly equal capability** —
the same UiDocument (declaration) + live state + the same action set (= the app's
effect-interface tools, schema-driven, authorised the same way). A person has no capability the
agent lacks. The existing polished UI (console and each app's own surface) stays as it is; this is
an additional "machine-equivalent view".

## Pieces

- `packages/effect-parity`:
  - `fromCatalogEntry(AppEntry)` → `ParityAppView { ns, appId, view, state, actions }`, where
    actions come **only** from `entry.registry.tools` (nothing extra) → person = agent.
  - `submitAction(source, name, args)` → only the agent's action set is allowed; an unknown name
    is an error.
  - `parityFromSnapshot(snapshot)` → rebuild the interactive view from the state frozen in a
    frame (replay).
- `packages/effect-observe` (**SQLite-backed**):
  - `ObservationSnapshot { at, perspective: app|agent|global, target, data }`; stable hash.
  - `createObservationStore(file?)`: table `observation_frames(at, perspective, target, data)`,
    index `(perspective, target, at)`; `record/frames/latest/count`, and reopening the file
    continues reading it.
  - `startObserver(...)`: one baseline frame, then changes only.
- `apps/effect-server` `monitor` plane (mounted beside `/console`):
  - `GET /-/mirror/:appId` — the agent's-eye parity view (live state plus the operable actions).
  - `POST /-/mirror/:appId/call` — run an action the way the agent does (same authorisation).
  - `GET /-/observe/tick` — sample the agent's perspective, storing a frame only on change (SQLite).
  - `GET /-/observe/frames?perspective=&target=` — frame list (the input to replay).

## Two presentations of one description + data

| | who reads it | what it is |
|---|---|---|
| **webui** | a person | the console: the one surface that draws a declared view, at `#view/<app>` |
| **lui** | the agent | the language form: the contract + state + actions (tools), at `/-/lui/:app` |

There was a third. `packages/effect-parity` `interactivePage(view, { submitUrl })` served a
hand-written HTML page — a textual view/state read-out, one `<form>` per action, and an inline
`<style>` with its own hex colours — at `GET /-/weblui/:appId`, submitting to
`POST /-/mirror/:appId/call`. It was lui rendered back to a person, and it was the second drawing
of a fact the console already draws: the same view, the same actions, a second set of colours that
nothing else in the product used. A person reads a canvas on the console now, so the page and the
two files that built it (`interactive.ts`, `form.ts`) are gone, along with the route.

The data projections stay, because they are the *other* reader's: `GET /-/mirror/:appId` returns
the parity view as JSON, `GET /-/lui/:appId?fmt=json|toml|compact|token` returns the render
contract in four notations, and `POST /-/mirror/:appId/call` runs an action the way the agent does
(same authorisation). Those are notations of one contract rather than renderings of one, and an
agent or a program is who reads them.

## RenderContract (the render-rule layer)

- Rules **attach to the component**: every element carries
  `component + data (binding) + interactive[{on, action, args}] + display`
  (`display:false` = an interactive control; `true` = display only); the document level adds the
  actions directory and the empty-data rule ("0 data still renders: layout + empty values +
  controls that remain usable").
- **projector** — one contract projects to `json` / `toml` / `compact` (each embedding the
  interaction annotations): `packages/effect-ui` `makeRenderContract(view, actions)`,
  `contractToJson/Toml/Compact(contract, data)`; data is injected through the binding paths.

### RenderContract v1 features (rules as first-class data)

- Element self-description:
  `component · data (binding path) · display · collapsible · interactive[{on, action, args}]`;
  document level: the `actions` directory + `emptyDataRule` (0 data still renders) +
  `rules{collapsibleIds, exclusive:true, expandOn:click}`.
- Projection: `contractToJson/Toml/Compact(contract, data)` + `contractToTokenized`
  (symbolised `@s#` + abbreviated `[+]`).
- **Symbolic wiring**: components are wired by a stable id (ref), so an update or a scroll can
  address just the referenced component (local scrolling); a long value repeated across
  occurrences is defined once and referenced as `@s#` elsewhere (fewer characters).

### Invisible to the app developer

- A developer writes only "what to show + the data + what actions exist"; the contract,
  abbreviation, symbolisation, reload targets and the projection (json·toml·compact·token) are
  **all derived by the engine**.
- Entry point: `packages/effect-ui` `defineUi({ view, actions, data? })` →
  `{ contract, project(data?) => { json, toml, compact, token } }`; the only optional domain
  annotation (that some data is a long list, that some button corresponds to some action) still
  goes through the existing view/actions semantics, with no lui detail in it.
