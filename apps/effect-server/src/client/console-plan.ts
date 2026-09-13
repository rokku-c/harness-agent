export interface ConsoleEntry { id: string; title: string; hasView: boolean; hasConfig: boolean; icon: string; color: string }
export type ConsoleSurface = "home" | "settings" | "view" | "config"
export interface ConsoleCatalogue {
  readonly ui?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string; readonly icon?: string; readonly color?: string }>
  readonly views?: ReadonlyArray<string>
  /** Interfaces that registered tools — an app that only speaks MCP has this. */
  readonly tools?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string }>
  readonly config?: ReadonlyArray<{ readonly appId: string; readonly title?: string; readonly icon?: string; readonly color?: string }>
}
export interface HomeApp { readonly id: string; readonly title: string; readonly opensConfig: boolean }
/**
 * The mark and colour an entry draws with, when the app did not send its own.
 * An app that declares neither still gets a stable, distinct tile: its initial
 * over one colour is derived from the id, so it never looks like another app and
 * the host still holds no list of app ids.
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
    if (old) return old
    const entry = { id, title, hasView: false, hasConfig: false, icon: "", color: defaultColor(id) }
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
  // An app that registers tools and no view still opens something — its tool
  // inspector — so it belongs in the launcher beside the apps that draw.
  for (const app of catalogue.tools ?? []) if (app.interfaceId) touch(app.interfaceId, app.title ?? app.interfaceId).hasView = true
  for (const app of catalogue.config ?? []) touch(app.appId, app.title ?? app.appId).hasConfig = true
  for (const entry of map.values()) if (entry.icon === "") entry.icon = entry.title.slice(0, 1).toUpperCase()
  return [...map.values()]
}
/** Home is an app springboard; config-only entries stay in Settings. */
export const homeApps = (plan: ConsoleEntry[]): HomeApp[] => plan.filter((entry) => entry.hasView).map((entry) => ({ id: entry.id, title: entry.title, opensConfig: false }))
export const configApps = (plan: ConsoleEntry[]) => plan.filter((entry) => entry.hasConfig).map(({ id, title }) => ({ id, title }))
/**
 * Which screen of an app the address bar names, and what it was opened with.
 *
 * Parameters ride in the query string, so a screen reads them as strings: a
 * number arrives as its digits. That is the one thing to know about them — they
 * are a *link's* worth of data, which is exactly what they are.
 */
export interface ConsoleDestination {
  readonly screen?: string
  /** Absent when the screen was entered with nothing, which is how it stays absent through a round trip. */
  readonly params?: Readonly<Record<string, string>>
}
export type ConsoleRoute = { kind: ConsoleSurface | "settings-config"; id?: string } & Partial<ConsoleDestination>

/** `#view/<app>`, then optionally `/<screen>` and `?<name>=<value>`. Written once, read in both places below. */
const DESTINATION = /^#(config|view)\/([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/
const decode = (value: string): string => { try { return decodeURIComponent(value) } catch { return value } }

/** The destination a hash names, on its own — no catalogue needed, because the view in the panel is what asks. */
export const parseDestination = (hash: string): ConsoleDestination => {
  const match = hash.match(DESTINATION)
  const screen = match?.[3]
  const params: Record<string, string> = {}
  for (const [name, value] of new URLSearchParams(match?.[4] ?? "")) params[name] = value
  return { ...(screen === undefined || screen === "" ? {} : { screen: decode(screen) }), ...(Object.keys(params).length === 0 ? {} : { params }) }
}

export const parseConsoleHash = (hash: string, plan: ConsoleEntry[]): ConsoleRoute => {
  if (hash === "#settings") return { kind: "settings" }; if (hash === "#" || hash === "") return { kind: "home" }
  const settingsMatch = hash.match(/^#settings\/config\/([^/?]+)/); if (settingsMatch) { try { const entry = plan.find((item) => item.id === decodeURIComponent(settingsMatch[1]) && item.hasConfig); return entry ? { kind: "settings-config", id: entry.id } : { kind: "settings" } } catch { return { kind: "settings" } } }
  const match = hash.match(DESTINATION); if (!match) return { kind: "home" }
  // The app id stops at the first `/`, so a screen name is never mistaken for it.
  try { const entry = plan.find((item) => item.id === decodeURIComponent(match[2]) && (match[1] === "view" ? item.hasView : item.hasConfig)); return entry ? { kind: match[1] as "view" | "config", id: entry.id, ...parseDestination(hash) } : { kind: "home" } } catch { return { kind: "home" } }
}
/** Where an app's own tile goes. The system apps own a surface, not a view. */
export const appRoute = (id: string, hasView: boolean): ConsoleRoute =>
  id === "settings" ? { kind: "settings" } : { kind: hasView ? "view" : "config", id }
