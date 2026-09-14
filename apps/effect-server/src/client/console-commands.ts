/**
 * What the command palette offers, in the order `design-system.md` §10.3 lists
 * it, and nothing else.
 *
 * A row invents no destination. Every one of them carries a `ConsoleRoute` built
 * from the app's own catalogue entry or from the place's own declared route, and
 * the palette hands that route to `navigate` — which is `hashOf` and the address
 * bar. So the palette is a second control over the routes the console already
 * answers, and not a second navigation graph: an address that the console cannot
 * resolve is not one the palette can produce.
 *
 * The rows that are not destinations say what they are instead of carrying a
 * fake route, and that is what keeps this file free of React: an appearance row
 * names a mode, `Read now` names the read, and the palette turns each into the
 * one call the console already has for it.
 *
 * The glyph of an app's row is the mark that app declared for itself, and the
 * glyph of a place's row is the mark the place declared — so a row teaches the
 * same identity the tile does, and adding an app adds no line here.
 */

import { appRoute, configApps, type ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"
import { THEME_MODES, themeLabel, type ThemeMode } from "./theme-runtime.ts"

export type CommandAction =
  | { readonly kind: "go"; readonly route: ConsoleRoute }
  | { readonly kind: "appearance"; readonly mode: ThemeMode }
  | { readonly kind: "read" }
  | { readonly kind: "shortcuts" }

export interface CommandRow {
  readonly id: string
  readonly label: string
  /** The line under the label: which app a screen belongs to. */
  readonly caption?: string
  /** A name from the closed glyph table, never a character (§8 rule 2). */
  readonly glyph: string
  /** The key the console already binds for this action, when it binds one. */
  readonly shortcut?: string
  readonly action: CommandAction
}

export const commandRows = ({ plan, route, screens, places }: {
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  /** The open app's screens. Empty when no app is open, and for an app whose view could not be read. */
  readonly screens: readonly ScreenPayload[]
  readonly places: readonly Place[]
}): readonly CommandRow[] => {
  const byKind = (kind: ConsoleRoute["kind"]): Place | undefined => places.find((place) => place.kinds.includes(kind))
  const settings = byKind("settings"), activity = byKind("activity")
  const rows: CommandRow[] = []
  for (const entry of plan) if (entry.hasView) rows.push({
    id: `app/${entry.id}`, label: `Open ${entry.title}`, glyph: entry.icon,
    action: { kind: "go", route: appRoute(entry.id) },
  })
  const open = route.kind === "app" ? route.id : undefined
  const app = plan.find((entry) => entry.id === open)
  if (open !== undefined) for (const screen of screens) rows.push({
    id: `screen/${open}/${screen.id}`, label: screen.title, caption: app?.title ?? open, glyph: "AppWindow",
    action: { kind: "go", route: { kind: "app", id: open, screen: screen.id } },
  })
  if (settings !== undefined) rows.push({
    id: "place/settings", label: `Open ${settings.title}`, glyph: settings.mark, shortcut: "g s",
    action: { kind: "go", route: settings.route },
  })
  for (const entry of configApps(plan)) rows.push({
    id: `configure/${entry.id}`, label: `Configure ${entry.title}`, glyph: entry.icon,
    action: { kind: "go", route: { kind: "settings", app: entry.id } },
  })
  if (activity !== undefined) rows.push({
    id: "place/activity", label: `Open ${activity.title}`, glyph: activity.mark,
    action: { kind: "go", route: activity.route },
  })
  for (const mode of THEME_MODES) rows.push({
    id: `appearance/${mode}`, label: `Appearance: ${themeLabel(mode)}`, glyph: "CircleHalf",
    action: { kind: "appearance", mode },
  })
  rows.push({ id: "read", label: "Read now", glyph: "ArrowClockwise", shortcut: "r", action: { kind: "read" } })
  rows.push({ id: "shortcuts", label: "Keyboard shortcuts", glyph: "Keyboard", shortcut: "?", action: { kind: "shortcuts" } })
  return rows
}

/** The palette's one filter: a substring of the words the row already shows, and nothing fetched. */
export const matches = (text: string, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  return needle === "" || text.toLowerCase().includes(needle)
}

export const filterCommands = (rows: readonly CommandRow[], query: string): readonly CommandRow[] =>
  rows.filter((row) => matches(`${row.label} ${row.caption ?? ""}`, query))
