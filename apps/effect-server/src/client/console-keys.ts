/**
 * The keys the console owns, and the one rule that makes owning them safe.
 *
 * `design-system.md` §10.3 is the whole table, and it is here as data rather
 * than as branches: the sheet `?` opens is generated from this array, so the
 * sheet cannot drift from what the shell actually binds. A key that is not in
 * this array does not exist.
 *
 * Two of the rows are the browser's own — `Tab`, and `Enter`/`Space` — and are
 * listed because the sheet describes the console's keyboard and not only its
 * handlers. Nothing here binds them: Radix's focus scope owns `Tab` inside an
 * open dialog, and the browser owns it everywhere else.
 *
 * `Escape` is listed and deliberately not bound. Every layer the console opens
 * is a Radix layer, Radix closes its own topmost layer on `Escape` and restores
 * the focus that opened it, and a handler here would have to re-derive which
 * layer is topmost and would then fight the one that already knows. With no
 * layer open `Escape` does nothing at all: it never navigates.
 *
 * The last rule is the one that keeps the map safe. No bare letter is hijacked
 * while a control that owns its own keystrokes has focus, so a letter typed
 * into a filter is always a letter.
 */

export interface KeyBinding {
  /** The keys, as the sheet prints them. `Mod` is Command on macOS, Control everywhere else. */
  readonly keys: string
  readonly action: string
  readonly scope: string
}

/** The console's own spelling of the platform's command modifier. */
export const modKey = (): string =>
  typeof navigator === "undefined" || !/Mac|iPhone|iPad/.test(navigator.userAgent) ? "Ctrl" : "⌘"

const MOD = modKey()

export const KEY_MAP: readonly KeyBinding[] = [
  { keys: `${MOD}+K`, action: "Open the command palette", scope: "Global" },
  { keys: "Escape", action: "Close the topmost overlay. With none open it does nothing, and it never navigates", scope: "Global" },
  { keys: "?", action: "Open the palette showing the keyboard list", scope: "Global, not while a text field has focus" },
  { keys: "g then h", action: "Go Home", scope: "Global, not while a text field has focus. The g prefix expires after 1500 ms" },
  { keys: "g then s", action: "Go Settings", scope: "Global, not while a text field has focus" },
  { keys: "r", action: "Read the current screen's sources again, now", scope: "Global, not while a text field has focus" },
  { keys: "Tab", action: "The browser's own order, with the focus scope inside an open dialog and nowhere else", scope: "Global" },
  { keys: "Enter", action: "Run the focused control", scope: "Any focusable control" },
]

/** The `g` prefix waits this long for its second key, and no longer (§10.3). */
export const CHORD_MS = 1500

/** An input whose type is not a text entry: a checkbox has no letter to lose. */
const UNTYPED = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "image", "color", "hidden"])

/** Whether this element is the text field, textarea, select or slider the key map does not reach into. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (target.closest("[contenteditable]:not([contenteditable='false']), [role='slider']") !== null) return true
  const field = target.closest("input, textarea, select")
  return field === null ? false : !(field instanceof HTMLInputElement) || !UNTYPED.has(field.type)
}

/** The command modifier and no other, so `Ctrl+R`, `Ctrl+L` and `Ctrl+1` stay the browser's. */
export const isMod = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
