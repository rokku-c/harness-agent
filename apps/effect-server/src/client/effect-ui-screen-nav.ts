import * as React from "react"
import type { StateStore } from "@json-render/core"
import { NAV_ROOT, ROOT_SCREEN, chainOf } from "@effect-agent/effect-ui"
import { useDestination } from "./console-route-hooks.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ScreenView {
  readonly chain: readonly ScreenPayload[]
  readonly current: ScreenPayload | undefined
  readonly params: Readonly<Record<string, string>>
}

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

export const useNavState = (store: StateStore, id: string | undefined, params: Readonly<Record<string, string>>): void => {
  const key = `${id ?? ""}?${new URLSearchParams(Object.entries(params)).toString()}`
  React.useLayoutEffect(() => { store.set(NAV_ROOT, { ...params }) }, [store, key, params])
}
