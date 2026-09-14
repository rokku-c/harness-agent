import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { appRoute, configApps, type ConsoleEntry } from "./console-plan.ts"
import { hashOf } from "./console-nav.ts"
import { CHORD_ROUTES } from "./console-chords.ts"
import type { CommandRow, PaletteInput } from "./console-commands.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"
import type { ViewPayload } from "./console-view-read.ts"

const chordFor = (route: ConsoleRoute): string | undefined => {
  const found = Object.entries(CHORD_ROUTES).find(([, chord]) => chord.kind === route.kind)
  return found === undefined ? undefined : `g ${found[0]}`
}

const landOn = (entry: ConsoleEntry): ConsoleRoute =>
  entry.hasView ? appRoute(entry.id)
    : entry.hasTools ? { kind: "tools", app: entry.id }
      : { kind: "settings", app: entry.id }

const where = (route: ConsoleRoute): string => route.kind === "tools" ? "operations" : "configuration"

const placeRows = (places: readonly Place[]): readonly CommandRow[] => places.map((place) => {
  const shortcut = chordFor(place.route)
  return {
    id: `place/${place.id}`, label: place.title, caption: "Place", glyph: place.mark,
    ...(shortcut === undefined ? {} : { shortcut }),
    address: hashOf(place.route), action: { kind: "go", route: place.route },
  }
})

const appRows = (plan: readonly ConsoleEntry[]): readonly CommandRow[] => plan.map((entry) => {
  const route = landOn(entry)
  return {
    id: `app/${entry.id}`, label: entry.title, caption: entry.hasView ? "App" : `App · ${where(route)}`,
    glyph: entry.icon, address: hashOf(route), owner: entry.id, action: { kind: "go", route },
  }
})

const appTitle = (plan: readonly ConsoleEntry[], id: string): string =>
  plan.find((entry) => entry.id === id)?.title ?? id

const screenRows = (view: ViewPayload | undefined, plan: readonly ConsoleEntry[]): readonly CommandRow[] =>
  view === undefined ? [] : view.screens.map((screen) => ({
    id: `screen/${view.id}/${screen.id}`, label: screen.title, caption: `Screen · ${appTitle(plan, view.id)}`,
    glyph: "AppWindow", owner: view.id,
    address: hashOf({ kind: "app", id: view.id, ...(screen.id === ROOT_SCREEN ? {} : { screen: screen.id }) }),
    action: {
      kind: "go",
      route: { kind: "app", id: view.id, ...(screen.id === ROOT_SCREEN ? {} : { screen: screen.id }) },
    },
  }))

const configRows = (plan: readonly ConsoleEntry[]): readonly CommandRow[] => configApps(plan).map((entry) => ({
  id: `configure/${entry.id}`, label: entry.title, caption: "Configuration", glyph: entry.icon,
  address: hashOf({ kind: "settings", app: entry.id }), owner: entry.id,
  action: { kind: "go", route: { kind: "settings", app: entry.id } },
}))

export const destinationRows = ({ plan, places, view }: PaletteInput): readonly CommandRow[] => [
  ...placeRows(places),
  ...appRows(plan),
  ...screenRows(view, plan),
  ...configRows(plan),
]
