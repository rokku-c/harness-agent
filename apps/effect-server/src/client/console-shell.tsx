import * as React from "react"
import { Container, Flex, Section } from "@radix-ui/themes"
import { ConsoleTheme } from "./console-theme.tsx"
import { ConsoleChrome } from "./console-chrome.tsx"
import { ConsoleDock } from "./console-dock.tsx"
import { useAddress } from "./console-route-hooks.ts"
import { loadCatalogue, loadStatusLine } from "./console-boot.ts"
import { useSource, sourceValue } from "./console-source.ts"
import { planConsole } from "./console-plan.ts"
import { parseConsoleHash, surfaceFor } from "./console-places.tsx"
import type { ConsoleSurfaces } from "./console-surfaces.ts"
import type { PlaceContext } from "./console-place.ts"

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
  const view = surface?.view(route, context) ?? null
  const main = React.useRef<HTMLDivElement>(null)
  return <ConsoleTheme>
    <Flex direction="column" height="100dvh">
      <ConsoleChrome plan={plan} route={route} status={status} home={home} body={main} />
      <div className="shell-body" ref={main} tabIndex={-1} id="console-main"
        data-shell-view={surface?.chrome ?? "page"} data-dock={home ? "off" : "on"}>
        {surface?.chrome === "fill"
          ? <Flex className="view-fill" direction="column" p="4">{view}</Flex>
          : <Section size="1" px="4"><Container>{view}</Container></Section>}
      </div>
      {home ? null : <ConsoleDock plan={plan} route={route} />}
    </Flex>
  </ConsoleTheme>
}
