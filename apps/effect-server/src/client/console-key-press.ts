import { isMac } from "./console-keys.ts"

const UNTYPED = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "image", "color", "hidden"])

export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (target.closest("[contenteditable]:not([contenteditable='false']), [role='slider']") !== null) return true
  const field = target.closest("input, textarea, select")
  return field === null ? false : !(field instanceof HTMLInputElement) || !UNTYPED.has(field.type)
}

export const isMod = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey

export const isModShift = (event: KeyboardEvent, key: string): boolean =>
  (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === key

const isReturnKey = (event: KeyboardEvent, arrow: string): boolean =>
  event.key === arrow && (isMac() ? event.metaKey : event.altKey)

export const isBackKey = (event: KeyboardEvent): boolean => isReturnKey(event, "ArrowLeft")
export const isForwardKey = (event: KeyboardEvent): boolean => isReturnKey(event, "ArrowRight")
