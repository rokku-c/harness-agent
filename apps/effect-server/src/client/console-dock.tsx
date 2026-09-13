/**
 * The launcher, as a dock along the bottom of the desktop.
 *
 * It belongs to the desktop — Home, Settings, and the app surfaces — because an
 * open app owns its page: while one is open the dock is not drawn at all, and
 * the way back is one small button in the corner. A launcher that is always
 * there is a second navigation every app has to share its page with.
 *
 * The tile's palette is the one the app declared for itself, so this file holds
 * no list of app ids and no per-app colour: adding an app never means editing
 * the console.
 */

import * as React from "react"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry, type ConsoleRoute } from "./console-plan.ts"

/** The palette the app declared, as the two steps a tile's gradient is made of. */
const palette = (color: string): React.CSSProperties =>
  ({ "--tile-9": `var(--${color}-9)`, "--tile-10": `var(--${color}-10)` }) as React.CSSProperties

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
  const apps = plan.filter((entry) => entry.hasView && appRoute(entry.id, entry.hasView).kind !== "settings")
  const here = (kind: ConsoleRoute["kind"], id?: string): boolean => route.kind === kind && (id === undefined || route.id === id)
  return <nav className="shell-dock" aria-label="Apps">
    {apps.map((entry) =>
      <Item key={entry.id} entry={entry} active={here("view", entry.id)} open={() => navigate(appRoute(entry.id, entry.hasView))} />)}
    <span className="shell-dock-divider" role="separator" aria-label="System" />
    <Item entry={SETTINGS} active={here("settings") || here("settings-config")} open={() => navigate({ kind: "settings" })} />
  </nav>
}
