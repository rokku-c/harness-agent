import type { ConsoleRoute } from "./console-route.ts"

export const parentRoute = (route: ConsoleRoute): ConsoleRoute | undefined => {
  switch (route.kind) {
    case "inbox": return route.decisionId === undefined ? undefined : { kind: "inbox" }
    case "tools":
      return route.operation === undefined ? undefined
        : { kind: "tools", ...(route.app === undefined ? {} : { app: route.app }) }
    case "settings": return route.app === undefined ? undefined : { kind: "settings" }
    case "app-settings": return { kind: "app", id: route.id }
    default: return undefined
  }
}
