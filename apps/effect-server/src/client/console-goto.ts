import type { ConsoleRoute } from "./console-route.ts"

type AppRoute = Extract<ConsoleRoute, { kind: "app" }>

let last: AppRoute | null = null

export const rememberApp = (route: ConsoleRoute): void => {
  if (route.kind === "app") last = route
}

export const lastApp = (): ConsoleRoute | undefined => last ?? undefined
