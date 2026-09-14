import type { ConsoleRoute } from "./console-route.ts"

export interface ConsoleEntry {
  id: string
  title: string
  hasView: boolean
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
    if (app.title) entry.title = app.title
    if (app.icon) entry.icon = app.icon
    if (app.color) entry.color = app.color
  }
  for (const id of catalogue.views ?? []) touch(id, id).hasView = true
  for (const app of catalogue.tools ?? []) if (app.interfaceId) touch(app.interfaceId, app.title ?? app.interfaceId).hasTools = true
  for (const app of catalogue.config ?? []) touch(app.appId, app.title ?? app.appId).hasConfig = true
  return [...map.values()]
}

export const configApps = (plan: readonly ConsoleEntry[]): readonly ConsoleEntry[] => plan.filter((entry) => entry.hasConfig)
export const appRoute = (id: string): ConsoleRoute => ({ kind: "app", id })
