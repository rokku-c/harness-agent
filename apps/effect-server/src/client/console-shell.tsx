/**
 * The console shell.
 *
 * A strip that says what this host is, the surface below it, and — on the
 * desktop alone — the dock.
 *
 * The two kinds of screen are framed differently, and deliberately. A document
 * screen — the launcher, settings — is the design system's own `Section` for
 * vertical rhythm and `Container` for how wide a page reads, so it stays as
 * tall as what it holds. An app surface is not a page: it is a tool, so it
 * takes exactly the area the chrome leaves and says for itself which part of
 * itself scrolls. That is the whole difference between a control and the answer
 * it produced being visible together, and the answer being somewhere below the
 * fold — and it is why the app route does not get a `Container`.
 */

import * as React from "react"
import { Callout, Container, Flex, Section } from "@radix-ui/themes"
import { ConsoleTheme } from "./console-theme.tsx"
import { ConsoleStatusBar } from "./console-status-bar.tsx"
import { ConsoleDock } from "./console-dock.tsx"
import { ConsoleShellMenu } from "./console-shell-menu.tsx"
import { ConsoleHome } from "./console-home.tsx"
import { ConsoleSettings } from "./console-settings.tsx"
import { ConsoleActivity } from "./console-activity-view.tsx"
import { MountedSurface } from "./console-mounted.tsx"
import { useRoute } from "./console-nav.ts"
import { loadCatalogue, loadStatusLine } from "./console-boot.ts"
import { planConsole, type ConsoleCatalogue, type ConsoleEntry, type ConsoleRoute } from "./console-plan.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

/** The desktop is where the launcher shows; an app route takes the whole surface. */
const isDesktop = (route: ConsoleRoute): boolean =>
  route.kind === "home" || route.kind === "settings" || route.kind === "settings-config"

const titleOf = (route: ConsoleRoute, plan: readonly ConsoleEntry[]): string => {
  if (route.kind === "settings" || route.kind === "settings-config") return "Settings"
  if (route.id === undefined) return "effect-agent"
  return plan.find((entry) => entry.id === route.id)?.title ?? "effect-agent"
}

const Content = ({ route, plan, surfaces }: {
  readonly route: ConsoleRoute
  readonly plan: readonly ConsoleEntry[]
  readonly surfaces: ConsoleSurfaces
}) => {
  if (route.kind === "home") return <ConsoleHome plan={plan} />
  if (route.kind === "settings" || route.kind === "settings-config") {
    return <ConsoleSettings plan={plan} selected={route.kind === "settings-config" ? route.id : undefined} config={surfaces.config} />
  }
  if (route.id === undefined) return null
  if (route.id === "activity" && route.kind === "view") return <ConsoleActivity />
  return <MountedSurface id={route.id} open={surfaces.view} />
}

export const ConsoleShell = ({ surfaces }: { readonly surfaces: ConsoleSurfaces }) => {
  const [catalogue, setCatalogue] = React.useState<ConsoleCatalogue | undefined>(undefined)
  const [status, setStatus] = React.useState("Loading system status…")
  const [failure, setFailure] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    let live = true
    void loadCatalogue().then((value) => { if (live) setCatalogue(value) }, (cause: Error) => { if (live) setFailure(cause.message) })
    void loadStatusLine().then((value) => { if (live) setStatus(value) })
    return () => { live = false }
  }, [])
  const plan = React.useMemo(() => planConsole(catalogue ?? {}), [catalogue])
  const route = useRoute(plan)
  const desktop = isDesktop(route)
  const notice = failure === undefined ? null : <Callout.Root color="red" mb={desktop ? "5" : "3"}><Callout.Text>{failure}</Callout.Text></Callout.Root>
  return <ConsoleTheme>
    <Flex direction="column" height="100dvh">
      <ConsoleStatusBar status={status} title={titleOf(route, plan)} home={route.kind === "home"} />
      <div className="shell-body" data-shell-view={desktop ? "home" : "app"}>
        {desktop
          ? <Section size="1" px="4"><Container>{notice}<Content route={route} plan={plan} surfaces={surfaces} /></Container></Section>
          : <Flex className="view-fill" direction="column" p="4">{notice}<Content route={route} plan={plan} surfaces={surfaces} /></Flex>}
      </div>
      {desktop ? <ConsoleDock plan={plan} route={route} /> : <ConsoleShellMenu />}
    </Flex>
  </ConsoleTheme>
}
