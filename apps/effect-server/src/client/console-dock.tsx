/**
 * The launcher, as a dock under the shell's own document screens.
 *
 * It is what the shell offers *besides* the springboard, and it is drawn only
 * where the springboard is not: under Settings. Home needs no dock — it is the
 * whole list, at full size — and an open app owns its page, so there the way to
 * another app is Home first, which is one press and one control.
 *
 * The tile's palette is the one the app declared for itself, so this file holds
 * no list of app ids and no per-app colour: adding an app never means editing
 * the console.
 */

import * as React from "react"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry, type ConsoleRoute } from "./console-plan.ts"

/**
 * The palette the app declared, as the three things a tile is made of: the two
 * steps its gradient runs between, and the colour that reads on top of them.
 * The third is not decoration — `amber` and `sky` answer with a dark ink and the
 * rest with white, so a tile that assumes white is unreadable on two palettes
 * and under AA on four more.
 */
const palette = (color: string): React.CSSProperties =>
  ({ "--tile-9": `var(--${color}-9)`, "--tile-10": `var(--${color}-10)`, "--tile-contrast": `var(--${color}-contrast)` }) as React.CSSProperties

const Item = ({ entry, active, open }: {
  readonly entry: ConsoleEntry
  readonly active: boolean
  readonly open: () => void
}) =>
  <button type="button" className="shell-dock-item" aria-label={entry.title} title={entry.title}
    aria-current={active ? "page" : undefined} onClick={open}>
    <span className="shell-dock-icon" style={palette(entry.color)} aria-hidden="true">{entry.icon}</span>
    <span className="shell-dock-label">{entry.title}</span>
  </button>

/** Settings is the shell's own surface, not an app: it carries no declaration of its own. */
const SETTINGS: ConsoleEntry = { id: "settings", title: "Settings", hasView: false, hasConfig: true, icon: "⚙", color: "gray" }

export const ConsoleDock = ({ plan, route }: { readonly plan: readonly ConsoleEntry[]; readonly route: ConsoleRoute }) => {
  const apps = plan.filter((entry) => entry.hasView && entry.id !== "settings")
  const here = (kind: ConsoleRoute["kind"], id?: string): boolean => route.kind === kind && (id === undefined || route.id === id)
  return <nav className="shell-dock" aria-label="Apps">
    {apps.map((entry) =>
      <Item key={entry.id} entry={entry} active={here("view", entry.id)} open={() => navigate(appRoute(entry.id))} />)}
    <span className="shell-dock-divider" role="separator" aria-label="System" />
    <Item entry={SETTINGS} active={here("settings") || here("settings-config")} open={() => navigate({ kind: "settings" })} />
  </nav>
}
