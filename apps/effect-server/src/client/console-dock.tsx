/**
 * The dock: every place, and every app that owns a screen.
 *
 * It is drawn on every route except Home, and the five places are the reason.
 * `flows.md` §1.2 makes "reachable from every other place in one action" part of
 * what a place *is*, so a console where Inbox cannot reach Activity without going
 * Home first has not built five places — it has built five pages. The old rule
 * ("no dock on Settings") was the same defect in miniature: it drew a launcher
 * under exactly one of the surfaces that needed it.
 *
 * Home needs no dock: it *is* the whole index, at full size, and a second copy of
 * it under itself is one control too many (H1, H5).
 *
 * Settings is the one entry that is not a place to work: it is the host's own
 * configuration, and it is pinned after a `Separator` rather than sorted among
 * the places it configures. Everything else — the four working places and every
 * app — is one run of like things, which is what lets a reader stop reading at
 * the separator.
 *
 * The mark each tile draws is the one that app or place declared for itself, so
 * this file holds no list of app ids and no per-app colour: adding an app, or a
 * place, never means editing the console. The tile is 64 x 64 with a 32 px mark
 * and a 12 px label (§10.2), and the dock is hand-written rather than a design
 * system component because it is the one thing the system has no component for;
 * what it is written *in* is the system's own tokens.
 */

import * as React from "react"
import { Separator } from "@radix-ui/themes"
import { AppAvatar, markOf, placeMark, type AppMark } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"
import { PLACES } from "./console-places.tsx"
import { SETTINGS } from "./console-place-settings.tsx"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

const Item = ({ mark, active, open }: { readonly mark: AppMark; readonly active: boolean; readonly open: () => void }) =>
  <button type="button" className="shell-dock-item" aria-label={mark.title} title={mark.title}
    aria-current={active ? "page" : undefined} onClick={open}>
    <AppAvatar mark={mark} size="2" />
    <span className="shell-dock-label">{mark.title}</span>
  </button>

/** The places that are places to work, in the order the dock draws them. */
const working: readonly Place[] = PLACES.filter((place) => place !== SETTINGS)

export const ConsoleDock = ({ plan, route }: { readonly plan: readonly ConsoleEntry[]; readonly route: ConsoleRoute }) => {
  const apps = plan.filter((entry) => entry.hasView)
  return <nav className="shell-dock" aria-label="Places and apps">
    {working.map((place) => <Item key={place.id} mark={placeMark(place)} active={place.kinds.includes(route.kind)}
      open={() => navigate(place.route)} />)}
    {apps.map((entry) => <Item key={entry.id} mark={markOf(entry)}
      active={(route.kind === "app" || route.kind === "app-settings") && route.id === entry.id}
      open={() => navigate(appRoute(entry.id))} />)}
    <Separator orientation="vertical" size="2" style={{ alignSelf: "center" }} />
    <Item mark={placeMark(SETTINGS)} active={SETTINGS.kinds.includes(route.kind)} open={() => navigate(SETTINGS.route)} />
  </nav>
}
