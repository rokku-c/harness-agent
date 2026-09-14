/**
 * The console shell.
 *
 * A strip that says what this host is, the surface the address names, and — on
 * every route except Home — the dock.
 *
 * The shell resolves an address by asking the registry which surface claims it,
 * and then draws whatever that surface returns. It holds no list of place names,
 * no branch per place, and no branch for the address that resolves to nothing:
 * the not-found pane registers like everything else (`console-places.tsx`), so
 * "what draws this route" is one lookup for all seven cases. That is `flows.md`
 * §9.9 and §9.10 in one line, and it is the difference between five places and
 * the old three-way special-casing with five names.
 *
 * How a surface is framed is the surface's own declaration. A place is a document
 * — the design system's `Section` for vertical rhythm and `Container` for how
 * wide a page reads, so it stays as tall as what it holds. An app is not a page:
 * it is a tool, so it takes exactly the area the chrome leaves and says for
 * itself which part of itself scrolls. That is the whole difference between a
 * control and the answer it produced being visible together, and the answer being
 * somewhere below the fold.
 */

import * as React from "react"
import { Container, Flex, Section } from "@radix-ui/themes"
import { ConsoleTheme } from "./console-theme.tsx"
import { ConsoleStatusBar } from "./console-status-bar.tsx"
import { ConsoleDock } from "./console-dock.tsx"
import { useAddress } from "./console-route-hooks.ts"
import { loadCatalogue, loadStatusLine } from "./console-boot.ts"
import { useSource, sourceValue } from "./console-source.ts"
import { planConsole } from "./console-plan.ts"
import { parseConsoleHash, surfaceFor, titleOf } from "./console-places.tsx"
import type { ConsoleSurfaces } from "./console-surfaces.ts"
import type { PlaceContext } from "./console-place.ts"

/**
 * The host's own plane table, read once for the chrome. It is not a source with a
 * freshness marker: the status line is chrome, and chrome that says "stale" is
 * noise on every route — a failed read here says so in its own words.
 */
const useStatusLine = (): string => {
  const [status, setStatus] = React.useState("Loading system status…")
  React.useEffect(() => {
    let live = true
    void loadStatusLine().then((value) => { if (live) setStatus(value) })
    return () => { live = false }
  }, [])
  return status
}

export const ConsoleShell = ({ surfaces }: { readonly surfaces: ConsoleSurfaces }) => {
  const catalogue = useSource("catalogue", loadCatalogue)
  const status = useStatusLine()
  const plan = React.useMemo(() => planConsole(sourceValue(catalogue.state) ?? {}), [catalogue.state])
  const hash = useAddress()
  // Re-resolved when the plan changes, so a deep link to an app resolves the moment the catalogue
  // lands rather than staying Not found until the next navigation. Resolution reads the plan and
  // never rewrites the address on account of what it finds (§2.H13).
  const route = React.useMemo(() => parseConsoleHash(hash, plan), [hash, plan])
  const surface = surfaceFor(route)
  const context = React.useMemo<PlaceContext>(() => ({
    plan, surfaces, status,
    catalogue: {
      ...(catalogue.state.status === "failed" ? { failure: catalogue.state.error } : {}),
      retry: catalogue.retry,
    },
  }), [plan, surfaces, status, catalogue.state, catalogue.retry])
  const home = route.kind === "home"
  const body = surface?.view(route, context) ?? null
  return <ConsoleTheme>
    <Flex direction="column" height="100dvh">
      <ConsoleStatusBar status={status} title={titleOf(route, plan)} home={home} />
      <div className="shell-body" data-shell-view={surface?.chrome ?? "page"} data-dock={home ? "off" : "on"}>
        {surface?.chrome === "fill"
          ? <Flex className="view-fill" direction="column" p="4">{body}</Flex>
          : <Section size="1" px="4"><Container>{body}</Container></Section>}
      </div>
      {home ? null : <ConsoleDock plan={plan} route={route} />}
    </Flex>
  </ConsoleTheme>
}
