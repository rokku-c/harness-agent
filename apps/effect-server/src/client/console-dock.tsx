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
