export interface KeyBinding {
  readonly keys: string
  readonly action: string
  readonly scope: string
}

export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)

export const modKey = (): string => (isMac() ? "⌘" : "Ctrl")

const MOD = modKey()
const BACK = isMac() ? "⌘" : "Alt"

export const KEY_MAP: readonly KeyBinding[] = [
  { keys: `${MOD}+K`, action: "Open the command palette, in command mode", scope: "Global" },
  { keys: `${MOD}+P`, action: "Open the command palette, in Go to mode: destinations only", scope: "Global" },
  { keys: "Up / Down", action: "Move the cursor one row, wrapping at either end", scope: "The command palette, while rows are listed" },
  { keys: "/", action: "Focus the current place's filter or search", scope: "Global, not while a text field has focus" },
  { keys: "?", action: "Open the shortcut sheet", scope: "Global, not while a text field has focus" },
  { keys: "g then h", action: "Go Home", scope: "Global, not while a text field has focus. The g prefix expires after 1500 ms" },
  { keys: "g then i", action: "Go Inbox", scope: "Global, not while a text field has focus" },
  { keys: "g then a", action: "Go Activity", scope: "Global, not while a text field has focus" },
  { keys: "g then t", action: "Go Tools", scope: "Global, not while a text field has focus" },
  { keys: "g then s", action: "Go Settings", scope: "Global, not while a text field has focus" },
  { keys: "g then l", action: "Go to the last app you were in, at the screen you left", scope: "Global, not while a text field has focus" },
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
