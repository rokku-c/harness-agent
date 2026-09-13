/**
 * Where the mounted view is: which screen is on top, which one it came from, and
 * what it was opened with.
 *
 * The address bar is the only record of that — see console-nav.ts — so there is
 * no stack object here to keep in step with it, and the browser's own history is
 * the stack a back control pops. What this adds is the screens *below* the top:
 * rebuilt from what each screen says its parent is, which is what turns a link
 * pasted cold into a screen you can back out of rather than a dead end.
 */

import * as React from "react"
import type { StateStore } from "@json-render/core"
import { NAV_ROOT, ROOT_SCREEN, chainOf } from "@effect-agent/effect-ui"
import { useDestination } from "./console-nav.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ScreenView {
  /** From the first screen down to the current one. */
  readonly chain: readonly ScreenPayload[]
  /** `undefined` only when the host mounted a runtime that carries no screen at all. */
  readonly current: ScreenPayload | undefined
  readonly params: Readonly<Record<string, string>>
}

/** A link naming a screen this view no longer has lands on the first one, not on nothing. */
const chainFor = (screens: readonly ScreenPayload[], screen: string | undefined): readonly ScreenPayload[] => {
  const walked = chainOf(screens, screen ?? ROOT_SCREEN)
  return walked.length === 0 ? chainOf(screens, ROOT_SCREEN) : walked
}

export const useScreenView = (screens: readonly ScreenPayload[]): ScreenView => {
  const destination = useDestination()
  return React.useMemo(() => {
    const chain = chainFor(screens, destination.screen)
    return { chain, current: chain[chain.length - 1], params: destination.params ?? {} }
  }, [screens, destination])
}

/**
 * The current screen's parameters, put in the store.
 *
 * In a layout effect, so before the browser paints: the screen that reads
 * `/_nav/...` is committed in the same pass, reads the previous screen's
 * parameters for that one instant, and is re-rendered with its own before
 * anything is drawn. Writing during render instead would have the store notify
 * the elements still mounted from the screen being left, which is a render
 * updating a component that is not the one rendering.
 *
 * Written whole, so a parameter an earlier screen was opened with is gone rather
 * than quietly still there — and the first screen of a view is entered with no
 * parameters at all rather than with the last screen's.
 */
export const useNavState = (store: StateStore, id: string | undefined, params: Readonly<Record<string, string>>): void => {
  const key = `${id ?? ""}?${new URLSearchParams(Object.entries(params)).toString()}`
  React.useLayoutEffect(() => { store.set(NAV_ROOT, { ...params }) }, [store, key, params])
}
