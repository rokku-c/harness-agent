# Console layout & headless UI catalog (Apple-HIG console, Radix-aligned declarative UI)

> Status: **implemented baseline, continuing migration.** Visual source of truth lives on the Doop canvas
> `x5S3nRhis1` (frames: baseline → A app-first → B control center → C/C2 iPadOS-style →
> C-v2 Apple HIG + C-mobile adaptive).
> Progress (September 9, 2026): theme tokens and `data-theme` injection are live; the console has
> Home, aggregated Settings, app-centric bottom Dock navigation, adaptive Dock overflow, and
> split browser modules with hash-route tests. The shared registry now covers primitive and system
> composite roles; Switch and Select render through Radix React primitives, the console publishes its
> own `systemUi` role/spec document, and the external `effect-ui-client.tsx` bundle owns boot and
> rendering. Flat, nested-object, and array config Specs mount through the same React path.

## 1. Goal

The effect-server console is an "operating-system" home for the effect-agent fleet: it
discovers apps from `effect.yaml`, renders each app's UI, and aggregates config. We want:

1. A **coherent, Apple-HIG-flavoured console layout** (Home springboard, bottom Dock,
   aggregated Settings) that adapts to laptop/tablet/phone and odd aspect ratios.
2. **One description path for every surface** — apps *and* the console/system itself — so
   the whole product is authored the same way.
3. **Radix as the behaviour baseline**: our declarative UI descriptions are *interchangeable*
   with headless primitives; the default renderer is React over `@radix-ui/react-*`. Other
   description/authoring forms convert onto that baseline **automatically, registry-driven,
   without bespoke adapters**.
4. **Global style injection**: appearance lives only in one theme layer (tokens +
   per-role recipes). Swapping the theme restyles every app and the system; no inline
   magic values in components.

## 2. Current seams (what we build on)

- Neutral description already exists: `packages/effect-ui/src/spec.ts` — `UiNodeSpec` is a
  closed union of five leaves (`text | stack | button | formField | list`) carrying **no
  styling**, only `bind` (state pointer) and `onPress`/actions. Comment: renderers can be
  swapped behind the `UiRenderer` seam.
- Conversions exist: `viewToJsonSpec` (EffectUiView → json-render Spec) and
  `formToJsonSpec` (zod config schema → json-render form Spec) in `packages/effect-ui`.
- Rendering: `@json-render/react` `<Renderer spec registry/>`; the React catalog lives in
  `apps/effect-server/src/client/effect-ui-catalog.tsx` (`defineRegistry` + `defineCatalog`).
  `packages/effect-ui/src/form-catalog.ts` exports the shared component schemas.
- Console chrome has a static HTML shell, but browser boot and role surfaces are bundled in
  `effect-ui-client.tsx`; `console/system-ui.ts` publishes the live shell Spec. The typed form
  runtime remains available as a deliberate fallback for malformed or unsupported declarations.

## 3. Layer model

```
 L0  authoring   EffectUiView · zod config schema · (raw json-render Spec) · future editors
      |   all project to the same neutral tree
 L1  interchange  UiDocument = json-render Spec: { role, props, children?, bind, action }
                  every node's role comes from ONE registry (zod props + JSON Schema)
      |   registry is single source of truth — adding a role covers validate + render + convert
 L2  roles        role registry:  zod props · bind/action contract · default headless primitive
 L3  behaviour    headless primitives, Radix-aligned (React) — state/focus/a11y/keyboard, zero chrome
 L4  theme        ONE token set (CSS custom properties) + per-role recipe · injected at root
 L5  renderers    React (@json-render/react, default) · html projection · lui/weblui text projections
```

Rules that make it work:

- **Canonical interchange = the Spec tree.** Whatever an app or the system authors, it
  becomes a tree of *role nodes*. Two Specs that render identically are structurally equal
  (same roles/props/bind), so theme swaps are pure L4.
- **Role → primitive is 1:1 registered, not hand-written.** Each role carries its zod props
  schema once. The catalog *renders* from that schema; the L0→Spec converters *validate and
  fill* from it. Adding a role = add schema + one headless implementation + one recipe. No
  per-adapter code anywhere else.
- **Description never names a renderer or a colour.** Roles are semantic
  (`Dialog`, `Tabs`, `Switch`, `StatusBadge`, …). `@radix-ui` only appears under L3/L5.
- **The system is an app.** Home springboard, Dock, Settings grouped list and the bottom
  tab bar are described with the same roles as any app view, so a global restyle covers the
  console too.

## 4. Radix as the behaviour baseline

"Radix is the baseline" means: for any role that is interactive/accessible, its behaviour
(open/close, focus trap, keyboard, aria wiring, roving focus, scroll locking) is taken from
a real `@radix-ui/react-*` primitive, then styled by the theme. Roles that are presentational
use a plain `Slot`/native element but expose the *same* role contract.

Default mapping (curated, extend as needed):

| Role (Spec node)            | Headless base |
| --------------------------- | ------------- |
| `Button`                    | Radix `Slot` + theme recipe |
| `TextField` / `SearchField` | native input headless (Radix ships none) |
| `Tabs` / `SegmentedControl` | `@radix-ui/react-tabs` |
| `Dialog` / `ConfirmDialog`  | `@radix-ui/react-dialog` |
| `Popover` / `Tooltip`       | `@radix-ui/react-popover` · `react-tooltip` |
| `Menu` / `DropdownMenu`     | `@radix-ui/react-dropdown-menu` |
| `Select`                    | `@radix-ui/react-select` |
| `Switch` · `Checkbox` · `RadioGroup` | `@radix-ui/react-switch` · `react-checkbox` · `react-radio-group` |
| `Accordion`                 | `@radix-ui/react-accordion` |
| `Toast` / notice            | `@radix-ui/react-toast` |
| `CommandPalette`            | compose `Dialog` + `Combobox` (`react-combobox` / `cmdk`) |
| `Label` · `Separator` · `ScrollArea` | `react-label` · `react-separator` · `react-scroll-area` |
| `NavigationMenu` (bottom Dock) | `@radix-ui/react-navigation-menu` |
| `List` / `Table` row        | composite over `Slot` + tokens |

Custom composite roles we add (presentational, but registered like any role so apps and the
system can declare them): `Springboard`/`AppIcon`, `Widget` (stat tile), `StatusBadge`/
status dot, `Dock` (with overflow states), `BottomTab`, `SettingsGroup`, `SearchField`,
`EmptyState`, `WebView` (embed an app's own live path in an iframe — the raw-HTML surface).

### Why "other description forms convert automatically"

The Spec tree is the hub; every authored form is a deterministic projection of it, and the
projection functions are **generated from the role registry**, not written per role:

- `EffectUiView` (5 leaves today) → Spec: a fixed, small kind→role table (`text→Text`,
  `stack→Stack`, `button→Button`, `formField→TextField`, `list→List`). The mapping is data,
  kept with the registry. Growing view semantics = adding rows, not new renderers.
- zod **config schema** → Spec: `formToJsonSpec` (exists). Input widgets derived from the
  Zod types already (string/number/boolean → TextField/NumberField/Switch), overridable by
  a per-role prop.
- App-provided raw `html` and live `path` → `WebView` role (exists in console-views as
  iframe/srcdoc; becomes a Spec node).
- Back-end: roles are schema-exportable (JSON Schema via zod), so any host can validate a
  Spec without importing React or Radix.

Because role props schemas are shared by the authoring converters *and* the React catalog,
**adding one component needs no parallel hand-written adapter anywhere** — that is the
"don't write extra code" property. Everything else (validation, rendering, conversion,
theme lookup) is generic over the registry.

## 5. Console layout (Apple HIG) — the first concrete app of the model

Chrome colours follow Apple system palette; accent stays brand green:

| Token | Value | Role |
| --- | --- | --- |
| `bg` | `#F2F2F7` | system grouped background |
| `surface` | `#FFFFFF` | cards, dock, dialogs |
| `separator` | `#E5E5EA` | hairlines |
| `label` | `#1C1C1E` · secondary `#6C6C70` · tertiary `#8E8E93` | text tiers |
| `accent` | `#178A5C` (+ `rgba(…,.13)` fill) | brand green |

- **Top bar is minimal**: Home plus appearance controls live on a compact status strip. Each
  screen carries its own Large Title (`Home`, `Settings`, …). No listener/port/host trivia in
  chrome.
- **Dock = bottom floating app launcher**: it belongs to Home, uses the same icon size and label
  treatment as Springboard, and shows an `All Apps` tile when the viewport cannot fit every app.
  Opening an app hides the Dock and leaves only the floating back-to-Home control.
- **Home = springboard**: widget row (running apps, active planes) + app icon grid
  (squircles with a live-status dot). Config-only daemons (`ai-gateway`, `agentd`) are **not**
  on Home; they live in Settings/Planes.
- **Settings aggregates all configs** (one place, schema-driven) — this removes the classic
  duplicate-entry problem of listing "views" and "config" as parallel rails.
- **Type**: `-apple-system` only; SF-style monochrome line icons (house/sliders/power/
  mirror/eye/terminal); mono reserved for config/code values. Hit targets ≥ 44 pt.

### Adaptive matrix

| Width | Navigation | Layout |
| --- | --- | --- |
| ≥ 1024 (desktop/landscape) | bottom Dock with labels | widgets 2+, springboard auto-fill, settings master–detail |
| 700–1023 (small laptop / tablet portrait) | compact bottom Dock | fewer springboard columns, settings list + push detail |
| < 700 (phone / narrow) | compact bottom Dock with `All Apps` overflow | 4-col springboard, full-screen app + back control |

Odd ratios (ultrawide / tall portrait): content is centered and sized by grid `auto-fit
minmax`; extra space is negative space or a contextual pane — never content stretched edge
to edge. Safe areas use `env(safe-area-inset-*)`.

## 6. Theme injection (restyle everything from one place)

- One CSS token set (the table above + radii/spacing/type scale/motion), exposed as CSS
  custom properties on `:root[data-theme=…]`.
- Per-role **recipes** map a role to concrete styles from tokens. Both catalog components
  and console chrome consume tokens only.
- Global restyle = swap token set (light / dark / accent / future brand) at the root; no
  component edits. All apps + the system inherit it because they share L4.
- The React catalog and config mount receive the same registry and token context from the single
  `console-client.js` bundle; the typed form runtime is only a fallback for schema shapes not yet
  representable by the role Spec.

## 7. Where this lands in the repo

- `packages/effect-ui` — grow the role registry (`spec.ts` union → open, registry-kept role
  set), keep `bind`/action/bridge semantics; keep neutral; export JSON Schema.
- `@json-render/core` / `@json-render/react` — unchanged contracts; the catalog under
  `apps/effect-server/src/client/effect-ui-catalog.tsx` + `packages/ui-renderer` grows from
  `Stack/Text/Button/Input` to the full role set, implemented on `@radix-ui/react-*`. Flat
  config Specs use the same React bundle through `effectUi.mountConfig`.
- `packages/effect-ui/src/form-catalog.ts` — becomes role schemas (shared by authoring and
  rendering), not per-renderer duplicates.
- `apps/effect-server` — console chrome (`console-page.ts`, `console-navigation.ts`,
  `console-browser-style.ts`) consumes the role vocabulary; `console/system-ui.ts` publishes
  the system shell as a Spec document; theme tokens + `data-theme` are injected by the console page.
- New deps (scoped where used): `@radix-ui/react-*` (+ `@radix-ui/react-slot`).

### Migration steps

1. Add theme module (tokens + recipe registry) and move all hard-coded catalog colours off
   it (`effect-ui-catalog.tsx`, `form-catalog.ts` consumers).
2. Stand up the role registry; migrate `formToJsonSpec`/`viewToJsonSpec` to registry-driven
   conversion; prove "add a role ⇒ author + validate + render + convert all update".
3. Build the composite roles the console needs (Springboard, Widget, Dock,
   SettingsGroup, BottomTab) on Radix behaviour.
4. Re-author the console chrome as Spec/roles (Home, Settings) — the system becomes an app.
5. Wire the adaptive matrix (bottom Dock ↔ app-mode hidden ↔ `All Apps`) as responsive behaviour
   of the `Dock`/`Springboard` roles.
6. Remove the typed form fallback once every schema shape has a lossless role-Spec editor.

## 8. Open questions

- Scope of `@radix-ui/react-*` adoption — full set vs a curated subset; pin version.
- Whether non-React projections (lui / web-lui text) must re-implement every role or may
  degrade gracefully to `Text/List/Button` (recommended: graceful degradation, roles declare
  a `minimalProjection`).
- Who owns the role registry package boundary (extend `effect-ui` vs new
  `@effect-agent/ui-roles`).
