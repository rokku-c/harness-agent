/**
 * What the console plans from: one entry per app the host has, and how it opens.
 *
 * An app is listed the way it declared itself — the registry holds what an app
 * registered, so the console adds no table of app ids and no name of its own
 * (`console-surface` §1). The three surfaces stay three flags, because an app can
 * have any combination of them and the address for each is its own: `#app/<id>`
 * is a view, `#tools/<app>` is a tool set, `#settings/<app>` is an editor. Today
 * one flag stands for "an app that registers tools" as well as "an app that
 * draws", which is what made a tools-only app open its inspector at the view
 * address and lose it again the moment it drew anything (`flows.md` §1.6).
 */

import type { ConsoleRoute } from "./console-route.ts"

export interface ConsoleEntry {
  id: string
  title: string
  /** The app declared a view, so `#app/<id>` has a start screen to show. */
  hasView: boolean
  /** The app registered operations, so `#tools/<app>` has a list to scope. */
  hasTools: boolean
  hasConfig: boolean
  icon: string
  color: string
}

export interface ConsoleCatalogue {
  readonly ui?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string; readonly icon?: string; readonly color?: string }>
  readonly views?: ReadonlyArray<string>
  readonly tools?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string }>
  readonly config?: ReadonlyArray<{ readonly appId: string; readonly title?: string; readonly icon?: string; readonly color?: string }>
}

/**
 * The colour an entry draws with when the app did not send its own: one palette
 * step derived from the id, so an app that declared no colour still gets a
 * stable tile that looks like no other app's, and the host still holds no list
 * of app ids.
 *
 * A *mark* is not derived this way. §8 rule 2 forbids a textual stand-in in a
 * tile's mark, so the only alternatives to the app's own declaration are an
 * invented glyph — which is a mark the app never chose — or nothing, and
 * `console-app-icon.tsx` draws nothing.
 */
export const PALETTE = ["jade", "iris", "grass", "sky", "cyan", "amber", "crimson", "violet", "orange", "teal"] as const
export const defaultColor = (id: string): string => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

export const planConsole = (catalogue: ConsoleCatalogue): ConsoleEntry[] => {
  const map = new Map<string, ConsoleEntry>()
  const touch = (id: string, title: string): ConsoleEntry => {
    const old = map.get(id)
    if (old !== undefined) return old
    const entry = { id, title, hasView: false, hasTools: false, hasConfig: false, icon: "", color: defaultColor(id) }
    map.set(id, entry)
    return entry
  }
  for (const app of catalogue.ui ?? []) if (app.interfaceId) {
    const entry = touch(app.interfaceId, app.title ?? app.interfaceId)
    entry.hasView = true
    // the app's own registration is what names it and draws it. A config record
    // is the config registry's note about the same app, so it fills a gap below
    // rather than overwriting this — otherwise an app whose config is titled by
    // its id would appear in the launcher under its id.
    if (app.title) entry.title = app.title
    if (app.icon) entry.icon = app.icon
    if (app.color) entry.color = app.color
  }
  for (const id of catalogue.views ?? []) touch(id, id).hasView = true
  for (const app of catalogue.tools ?? []) if (app.interfaceId) touch(app.interfaceId, app.title ?? app.interfaceId).hasTools = true
  for (const app of catalogue.config ?? []) touch(app.appId, app.title ?? app.appId).hasConfig = true
  return [...map.values()]
}

/** Settings' rows: one configurable app, one editor. The whole entry, because a row draws the app's own mark. */
export const configApps = (plan: readonly ConsoleEntry[]): readonly ConsoleEntry[] => plan.filter((entry) => entry.hasConfig)
/** Where an app's own tile goes. Every app that has one draws at its own address, with no id special-cased. */
export const appRoute = (id: string): ConsoleRoute => ({ kind: "app", id })
