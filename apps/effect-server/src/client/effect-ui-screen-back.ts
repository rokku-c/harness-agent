import * as React from "react"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { backTarget, canGoBack } from "./console-stack.ts"
import { navigate } from "./console-nav.ts"
import { parseDestination } from "./console-route.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ScreenBack {
  readonly back: () => void
  readonly returnTo?: ScreenPayload
}

export const useScreenBack = (
  appId: string,
  chain: readonly ScreenPayload[],
  screens: readonly ScreenPayload[],
): ScreenBack => {
  const back = React.useCallback(() => {
    if (canGoBack()) { window.history.back(); return }
    const parent = chain[chain.length - 2]?.id
    navigate({ kind: "app", id: appId, ...(parent === undefined || parent === ROOT_SCREEN ? {} : { screen: parent }) })
  }, [appId, chain])
  const returnTo = React.useMemo(() => {
    const parent = chain[chain.length - 2]
    if (!canGoBack()) return parent
    const screen = parseDestination(backTarget() ?? "").screen ?? ROOT_SCREEN
    return screens.find((candidate) => candidate.id === screen) ?? parent
  }, [chain, screens])
  return { back, returnTo }
}
