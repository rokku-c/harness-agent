/**
 * Up one level, and what that level is called.
 *
 * A screen this session walked to has the screen it came from behind it in the
 * browser's history, and going back through that history is what keeps the
 * ancestors' own parameters; a screen the reader pasted in has nothing behind it,
 * and there the chain the view declares is the answer (`screen.ts`), which is
 * also the only one that cannot leave the product. Both facts live in one place
 * because they are one question asked twice: where does leaving this screen land,
 * and what is that place called.
 *
 * The label is that destination's own title and never the word "Back" (§2.H5).
 * Two controls that both read as "back" is the defect this replaces, and a reader
 * who can read where they are going does not have to press to find out.
 */

import * as React from "react"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { backTarget, canGoBack } from "./console-stack.ts"
import { navigate } from "./console-nav.ts"
import { parseDestination } from "./console-route.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ScreenBack {
  /** The one level up, by the history when this session walked here and by the declared chain otherwise. */
  readonly back: () => void
  /** The screen that leaving this one lands on, when there is one. */
  readonly returnTo?: ScreenPayload
}

export const useScreenBack = (
  appId: string,
  chain: readonly ScreenPayload[],
  screens: readonly ScreenPayload[],
): ScreenBack => {
  const back = React.useCallback(() => {
    if (canGoBack()) { window.history.back(); return }
    // The first screen is `nodes`, and the address names it by saying nothing.
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
