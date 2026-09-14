/**
 * What a press is, before anything decides what it does.
 *
 * These are the five questions the dispatcher asks about a `KeyboardEvent`, and
 * each one is a rule from §6.3 rather than a convenience.
 *
 * `isTypingTarget` is the rule that keeps the map safe: while a text field,
 * textarea, select or slider has focus, no bare key is the console's, so a letter
 * typed into a filter is always a letter. A checkbox has no letter to lose, which
 * is why the test is on the input's *type* and not on the tag.
 *
 * `isMod` and `isModShift` are the rule that keeps the browser's own keys: the
 * command modifier alone is `Mod+K` and `Mod+P`, and with `Shift` it is copying
 * and refreshing, so `Ctrl+R` is still reload and `Ctrl+S` is still save.
 *
 * The two arrow chords are the platform's return key, and they are the one place
 * the console takes a key the browser already had — `Alt+Left` is back on Windows
 * and Linux, which is why the dispatcher prevents the default. On macOS `Alt+Left`
 * is a word move, so the chord is `⌘+Left`, the same key the platform puts on the
 * control that does this (`console-screen-panes.tsx`).
 */

import { isMac } from "./console-keys.ts"

/** An input whose type is not a text entry: a checkbox has no letter to lose. */
const UNTYPED = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "image", "color", "hidden"])

/** Whether this element is the text field, textarea, select or slider the key map does not reach into. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (target.closest("[contenteditable]:not([contenteditable='false']), [role='slider']") !== null) return true
  const field = target.closest("input, textarea, select")
  return field === null ? false : !(field instanceof HTMLInputElement) || !UNTYPED.has(field.type)
}

/** The command modifier and no other. */
export const isMod = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey

/** The same modifier with `Shift`, which is how §6.3 keeps copying and refreshing off the bare letters. */
export const isModShift = (event: KeyboardEvent, key: string): boolean =>
  (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === key

const isReturnKey = (event: KeyboardEvent, arrow: string): boolean =>
  event.key === arrow && (isMac() ? event.metaKey : event.altKey)

export const isBackKey = (event: KeyboardEvent): boolean => isReturnKey(event, "ArrowLeft")
export const isForwardKey = (event: KeyboardEvent): boolean => isReturnKey(event, "ArrowRight")
