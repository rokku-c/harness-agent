import * as React from "react"
import { hashOf } from "./console-nav.ts"
import { isTypingTarget } from "./console-key-press.ts"
import type { ConsoleRoute } from "./console-route.ts"

const headingIn = (body: HTMLElement): HTMLElement | null =>
  body.querySelector<HTMLElement>("[data-route-heading]") ?? body.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6")

export const useRouteFocus = (route: ConsoleRoute, body: React.RefObject<HTMLElement | null>): void => {
  const address = hashOf(route)
  React.useEffect(() => {
    const node = body.current
    if (node === null || isTypingTarget(document.activeElement)) return
    const frame = requestAnimationFrame(() => {
      const heading = headingIn(node)
      if (heading === null) { node.focus({ preventScroll: true }); return }
      heading.setAttribute("tabindex", "-1")
      heading.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [address, body])
}
