import * as React from "react"
import { isTypingTarget } from "./console-key-press.ts"

const LAYER = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
].join(", ")

export const layerOpen = (): boolean => document.querySelector(LAYER) !== null

let leave: (() => void) | null = null

export const setScreenLeave = (handler: (() => void) | null): void => { leave = handler }

export const leaveScreen = (): boolean => {
  if (leave === null) return false
  leave()
  return true
}

export const useConsoleEscape = (onParent: () => void): void => {
  const latest = React.useRef(onParent)
  React.useEffect(() => { latest.current = onParent })
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || isTypingTarget(event.target) || layerOpen()) return
      event.preventDefault()
      if (!leaveScreen()) latest.current()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
