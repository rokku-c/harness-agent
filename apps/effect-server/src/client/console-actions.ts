import * as React from "react"
import { navigate } from "./console-nav.ts"
import { canGoBack } from "./console-stack.ts"
import { lastApp } from "./console-goto.ts"
import { copyDeepLink } from "./console-deep-link.ts"
import { parentRoute } from "./console-parent.ts"
import type { ConsoleKeys } from "./console-keyboard.ts"
import type { ConsoleRoute } from "./console-route.ts"

export type ConsoleMoves = Pick<ConsoleKeys, "go" | "goLast" | "back" | "forward" | "focusFilter" | "copyLink">

export const useConsoleMoves = (
  route: ConsoleRoute,
  body: React.RefObject<HTMLElement | null>,
): ConsoleMoves => {
  const back = React.useCallback(() => {
    if (canGoBack()) { window.history.back(); return }
    const parent = parentRoute(route)
    if (parent !== undefined) navigate(parent)
  }, [route])
  return {
    go: React.useCallback((target: ConsoleRoute) => navigate(target), []),
    goLast: React.useCallback(() => {
      const last = lastApp()
      if (last !== undefined) navigate(last)
    }, []),
    back,
    forward: React.useCallback(() => window.history.forward(), []),
    focusFilter: React.useCallback(() => {
      body.current?.querySelector<HTMLElement>("[data-filter]")?.focus({ preventScroll: true })
    }, [body]),
    copyLink: React.useCallback(() => void copyDeepLink(), []),
  }
}
