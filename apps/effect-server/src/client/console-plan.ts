export interface ConsoleEntry { id: string; title: string; hasView: boolean; hasConfig: boolean }
export type ConsoleSurface = "home" | "settings" | "view" | "config"
export interface ConsoleDockItem { readonly id: string; readonly title: string; readonly surface: ConsoleSurface; readonly persistent?: boolean }
export interface ConsoleSystemUi { readonly elements: Record<string, { readonly type: string; readonly props?: Record<string, unknown> }> }
export interface ConsoleCatalogue {
  readonly ui?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string }>
  readonly views?: ReadonlyArray<string>
  readonly config?: ReadonlyArray<{ readonly appId: string; readonly title?: string }>
  readonly systemUi?: ConsoleSystemUi
}
export interface HomeApp { readonly id: string; readonly title: string; readonly opensConfig: boolean }
export const planConsole = (catalogue: ConsoleCatalogue): ConsoleEntry[] => {
  const map = new Map<string, ConsoleEntry>(), touch = (id: string, title: string) => { const old = map.get(id); if (old) return old; const entry = { id, title, hasView: false, hasConfig: false }; map.set(id, entry); return entry }
  for (const app of catalogue.ui ?? []) if (app.interfaceId) { const entry = touch(app.interfaceId, app.title ?? app.interfaceId); entry.hasView = true; if (app.title) entry.title = app.title }
  for (const id of catalogue.views ?? []) touch(id, id).hasView = true
  for (const app of catalogue.config ?? []) { const entry = touch(app.appId, app.title ?? app.appId); entry.hasConfig = true; if (app.title) entry.title = app.title }
  return [...map.values()]
}
export const homeApps = (plan: ConsoleEntry[]): HomeApp[] => plan.filter((entry) => entry.hasView || entry.hasConfig).map((entry) => ({ id: entry.id, title: entry.title, opensConfig: !entry.hasView }))
export const configApps = (plan: ConsoleEntry[]) => plan.filter((entry) => entry.hasConfig).map(({ id, title }) => ({ id, title }))
export type ConsoleRoute = { kind: ConsoleSurface | "settings-config" | "apps"; id?: string }
export const parseConsoleHash = (hash: string, plan: ConsoleEntry[]): ConsoleRoute => {
  if (hash === "#apps") return { kind: "apps" }; if (hash === "#settings") return { kind: "settings" }; if (hash === "#") return { kind: "home" }
  const settingsMatch = hash.match(/^#settings\/config\/(.+)$/); if (settingsMatch) { try { const entry = plan.find((item) => item.id === decodeURIComponent(settingsMatch[1]) && item.hasConfig); return entry ? { kind: "settings-config", id: entry.id } : { kind: "settings" } } catch { return { kind: "settings" } } }
  const match = hash.match(/^#(config|view)\/(.+)$/); if (!match) return { kind: "home" }
  try { const entry = plan.find((item) => item.id === decodeURIComponent(match[2]) && (match[1] === "view" ? item.hasView : item.hasConfig)); return entry ? { kind: match[1] as "view" | "config", id: entry.id } : { kind: "home" } } catch { return { kind: "home" } }
}
