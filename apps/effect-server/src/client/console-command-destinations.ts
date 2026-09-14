/**
 * §6.4's first four groups: the places, the apps, the screens of the app in
 * question, and the apps that can be configured.
 *
 * None of these needs a read. Every row is built from the catalogue the shell
 * already holds, the place's own declared route, or the payload the mounted view
 * was built from — which is why the palette opens without a network call and why
 * a row cannot describe a destination the console would not answer.
 *
 * The screens are the one group with a subject: the app the query names when it
 * names one, and otherwise the app that is open (§6.4: "the current app's
 * screens; with a space and an app name, any app's screens"). That is pure
 * navigation — `#app/board/task` is an address like any other — so it needs
 * nothing mounted, which is exactly what the Actions group does need and why the
 * two are fed from different payloads (`console-command-console.ts`).
 */

import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { appRoute, configApps, type ConsoleEntry } from "./console-plan.ts"
import { hashOf } from "./console-nav.ts"
import { CHORD_ROUTES } from "./console-chords.ts"
import type { CommandRow, PaletteInput } from "./console-commands.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"
import type { ViewPayload } from "./console-view-read.ts"

/**
 * The key that already goes to this place, read from the chord table rather than
 * written again — so the sheet and the palette cannot come to disagree about
 * which key goes where, and a place whose key changes changes in one place.
 */
const chordFor = (route: ConsoleRoute): string | undefined => {
  const found = Object.entries(CHORD_ROUTES).find(([, chord]) => chord.kind === route.kind)
  return found === undefined ? undefined : `g ${found[0]}`
}

/**
 * Where an app's own row lands. An app that draws opens its start screen; one
 * that does not has no start screen to open, so its row is the surface it does
 * have — the defect §1.6 names is an app opening a view it never declared.
 */
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

/** The catalogue's name for an app: the label a row about it is read as, never its id. */
const appTitle = (plan: readonly ConsoleEntry[], id: string): string =>
  plan.find((entry) => entry.id === id)?.title ?? id

const screenRows = (view: ViewPayload | undefined, plan: readonly ConsoleEntry[]): readonly CommandRow[] =>
  view === undefined ? [] : view.screens.map((screen) => ({
    id: `screen/${view.id}/${screen.id}`, label: screen.title, caption: `Screen · ${appTitle(plan, view.id)}`,
    glyph: "AppWindow", owner: view.id,
    // The first screen is the address that names no screen, so one screen has one address (§console-nav).
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
