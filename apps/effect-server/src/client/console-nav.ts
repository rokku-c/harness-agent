import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import type { ConsoleDestination, ConsoleRoute } from "./console-route.ts"
import { pushed } from "./console-stack.ts"

const segment = (value: string | undefined): string => value === undefined || value === "" ? "" : `/${encodeURIComponent(value)}`
const query = (params: object | undefined): string => {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params ?? {})) if (typeof value === "string" && value !== "") search.set(name, value)
  return search.toString() === "" ? "" : `?${search.toString()}`
}

export const hashOf = (route: ConsoleRoute): string => {
  switch (route.kind) {
    case "home": return "#"
    case "inbox": return `#inbox${segment(route.decisionId)}`
    case "activity": return `#activity${query(route.filter)}`
    case "tools": return `#tools${segment(route.app)}${segment(route.operation)}`
    case "settings": return `#settings${segment(route.app)}`
    case "app": return `#app/${encodeURIComponent(route.id)}${segment(route.screen === ROOT_SCREEN ? undefined : route.screen)}${query(route.params)}`
    case "app-settings": return `#app/${encodeURIComponent(route.id)}/settings`
    case "not-found": return route.address === "" ? "#" : route.address
  }
}

const here = (): string => window.location.hash === "" ? "#" : window.location.hash

export const navigate = (route: ConsoleRoute): void => {
  const hash = hashOf(route)
  if (hash === here()) return
  pushed(hash)
  window.location.hash = hash
}

export const openScreen = (id: string, destination: ConsoleDestination): void =>
  navigate({ kind: "app", id, ...destination })
