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
 * The tile's palette is what each registrant declared for itself, so this file
 * holds no list of app ids and no per-app colour: adding an app, or a place,
 * never means editing the console.
 */

import * as React from "react"
import { markOf, type AppMark } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"
import { PLACES } from "./console-places.tsx"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

/**
 * The palette a tile declared, as the three things it is made of: the two steps
 * its gradient runs between, and the colour that reads on top of them.
 * The third is not decoration — `amber` and `sky` answer with a dark ink and the
 * rest with white, so a tile that assumes white is unreadable on two palettes
 * and under AA on four more.
 */
const palette = (color: string): React.CSSProperties =>
  ({ "--tile-9": `var(--${color}-9)`, "--tile-10": `var(--${color}-10)`, "--tile-contrast": `var(--${color}-contrast)` }) as React.CSSProperties

const Item = ({ mark, active, open }: { readonly mark: AppMark; readonly active: boolean; readonly open: () => void }) =>
  <button type="button" className="shell-dock-item" aria-label={mark.title} title={mark.title}
    aria-current={active ? "page" : undefined} onClick={open}>
    <span className="shell-dock-icon" style={palette(mark.color)} aria-hidden="true">{mark.icon}</span>
    <span className="shell-dock-label">{mark.title}</span>
  </button>

const placeMark = (place: Place): AppMark => ({ title: place.title, icon: place.mark, color: place.color })

export const ConsoleDock = ({ plan, route }: { readonly plan: readonly ConsoleEntry[]; readonly route: ConsoleRoute }) => {
  const apps = plan.filter((entry) => entry.hasView)
  return <nav className="shell-dock" aria-label="Places and apps">
    {PLACES.map((place) => <Item key={place.id} mark={placeMark(place)} active={place.kinds.includes(route.kind)}
      open={() => navigate(place.route)} />)}
    {apps.length === 0 ? null : <span className="shell-dock-divider" role="separator" aria-label="Apps" />}
    {apps.map((entry) => <Item key={entry.id} mark={markOf(entry)}
      active={(route.kind === "app" || route.kind === "app-settings") && route.id === entry.id}
      open={() => navigate(appRoute(entry.id))} />)}
  </nav>
}
