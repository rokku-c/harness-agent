import type { ConsoleRoute } from "./console-route.ts"

export const CHORD_ROUTES: Readonly<Record<string, ConsoleRoute>> = {
  h: { kind: "home" },
  i: { kind: "inbox" },
  a: { kind: "activity", filter: {} },
  t: { kind: "tools" },
  s: { kind: "settings" },
}

export const CHORD_MS = 1500
