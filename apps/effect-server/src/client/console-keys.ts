/**
 * The keys the console owns, and the rules that make owning them safe.
 *
 * `flows.md` §6.3 is the whole table, and it is here as data rather than as
 * branches: the sheet `?` opens is generated from this array, so the sheet cannot
 * drift from what the shell actually binds. A key that is not in this array does
 * not exist, which is why the map gains a row in the same change that binds it —
 * and only then. The rows are in the document's own order, which is its grouping
 * by scope.
 *
 * That rule is why the sheet is shorter than §6.3's table and honest about it.
 * The list keys — `j`/`k`, `Home`/`End`, `o`, `x`, `a`/`d`, `A`/`D`, `h`, `n`,
 * `t`, `f` — and the form keys (`Mod+Enter`, `Mod+S`, `Mod+Shift+S`, `Esc` on a
 * dirty form) are designed and not yet bound, and a row for one of them here
 * would be a sheet teaching a key that does nothing. They arrive with the lists
 * and forms that own them.
 *
 * Two of the rows are the browser's own — `Tab`, and `Enter` — and are listed
 * because the sheet describes the console's keyboard and not only its handlers.
 * Nothing here binds them: Radix's focus scope owns `Tab` inside an open dialog,
 * and the browser owns it everywhere else.
 *
 * What a press of one of these means is `console-key-press.ts`'s question, and
 * the `g` prefix's second keys are `console-chords.ts`'s. This file is the list.
 */

export interface KeyBinding {
  /** The keys, as the sheet prints them. `Mod` is Command on macOS, Control everywhere else. */
  readonly keys: string
  readonly action: string
  readonly scope: string
}

/** Whether this is the platform whose command modifier is Command. */
export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)

/** The console's own spelling of the platform's command modifier. */
export const modKey = (): string => (isMac() ? "⌘" : "Ctrl")

const MOD = modKey()
// The platform's return key: `⌘+Left` on macOS, `Alt+Left` everywhere the browser
// already uses `Alt+Left` for back (`console-key-press.ts`).
const BACK = isMac() ? "⌘" : "Alt"

export const KEY_MAP: readonly KeyBinding[] = [
  { keys: `${MOD}+K`, action: "Open the command palette, in command mode", scope: "Global" },
  { keys: `${MOD}+P`, action: "Open the command palette, in Go to mode: destinations only", scope: "Global" },
  // The palette's own two keys. They are §6.2 rule 4's list keys, and the palette is the
  // only list that binds them so far — the scope says where the press is answered, so it
  // widens the day a second list owns them, and not before.
  { keys: "Up / Down", action: "Move the cursor one row, wrapping at either end", scope: "The command palette, while rows are listed" },
  { keys: "/", action: "Focus the current place's filter or search", scope: "Global, not while a text field has focus" },
  { keys: "?", action: "Open the shortcut sheet", scope: "Global, not while a text field has focus" },
  { keys: "g then h", action: "Go Home", scope: "Global, not while a text field has focus. The g prefix expires after 1500 ms" },
  { keys: "g then i", action: "Go Inbox", scope: "Global, not while a text field has focus" },
  { keys: "g then a", action: "Go Activity", scope: "Global, not while a text field has focus" },
  { keys: "g then t", action: "Go Tools", scope: "Global, not while a text field has focus" },
  { keys: "g then s", action: "Go Settings", scope: "Global, not while a text field has focus" },
  { keys: "g then l", action: "Go to the last app you were in, at the screen you left", scope: "Global, not while a text field has focus" },
  // The places with a second level — a decision inside the Inbox, an operation inside
  // Tools, an app's configuration — are the shell's to leave; an app's own screens are the
  // mounted view's (`console-escape.ts`). One press, one of the two answers it.
  { keys: `${BACK}+Left`, action: "Return to the parent screen", scope: "App routes and the places with a second level" },
  { keys: "Alt+Right", action: "Forward one screen, when this session walked there", scope: "Global" },
  {
    keys: "Esc",
    action: "Close the topmost layer. With none open, return to the parent screen",
    scope: "Global, not while a text field, textarea, select or slider has focus",
  },
  { keys: `${MOD}+Shift+C`, action: "Copy a deep link to exactly what is on screen", scope: "Global" },
  { keys: `${MOD}+Shift+R`, action: "Refresh every source on the current screen", scope: "Global" },
  { keys: "Tab", action: "The browser's own order, with the focus scope inside an open dialog and nowhere else", scope: "Global" },
  { keys: "Enter", action: "Run the focused control", scope: "Any focusable control" },
]
