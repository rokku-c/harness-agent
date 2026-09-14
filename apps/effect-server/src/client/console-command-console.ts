import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { hashOf } from "./console-nav.ts"
import { modKey } from "./console-keys.ts"
import { THEME_MODES, themeLabel } from "./theme-runtime.ts"
import type { CommandRow, PaletteInput } from "./console-commands.ts"
import type { UiActionSpec } from "@effect-agent/effect-ui"
import type { ViewPayload } from "./console-view-read.ts"

const runsFromHere = (action: UiActionSpec): boolean =>
  (action.params === undefined || Object.keys(action.params).length === 0) &&
  (action.url === undefined || action.method === "GET")

const pressedBy = (element: unknown): string | undefined => {
  const on = (element as { on?: { press?: { action?: unknown } } }).on
  return typeof on?.press?.action === "string" ? on.press.action : undefined
}

const holderOf = (view: ViewPayload, name: string): string | undefined =>
  view.screens.find((screen) => Object.values(screen.spec.elements).some((element) => pressedBy(element) === name))?.id

export const actionRows = ({ plan, view, open }: PaletteInput): readonly CommandRow[] => {
  if (view === undefined || open === undefined || view.id !== open) return []
  const title = plan.find((entry) => entry.id === view.id)?.title ?? view.id
  return (view.actions ?? []).flatMap((action): readonly CommandRow[] => {
    const row = { id: `action/${view.id}/${action.name}`, label: action.name, caption: `Action · ${title}`, glyph: "Check", owner: view.id }
    if (runsFromHere(action)) return [{ ...row, action: { kind: "run", app: view.id, name: action.name } }]
    const screen = holderOf(view, action.name)
    if (screen === undefined) return []
    const route = { kind: "app", id: view.id, ...(screen === ROOT_SCREEN ? {} : { screen }) } as const
    return [{ ...row, address: hashOf(route), action: { kind: "go", route } }]
  })
}

export const consoleRows = ({ decisions }: PaletteInput): readonly CommandRow[] => {
  const rows: CommandRow[] = THEME_MODES.map((mode) => ({
    id: `appearance/${mode}`, label: `Appearance: ${themeLabel(mode)}`, caption: "Console", glyph: "CircleHalf",
    action: { kind: "appearance", mode },
  }))
  rows.push({
    id: "read", label: "Read now", caption: "Console", glyph: "ArrowClockwise",
    shortcut: `${modKey()}+Shift+R`, action: { kind: "read" },
  })
  rows.push({
    id: "copy", label: "Copy a link to this screen", caption: "Console", glyph: "ArrowSquareOut",
    shortcut: `${modKey()}+Shift+C`, action: { kind: "copy" },
  })
  rows.push({ id: "shortcuts", label: "Keyboard shortcuts", caption: "Console", glyph: "Keyboard", shortcut: "?", action: { kind: "shortcuts" } })
  const newest = decisions.find((decision) => decision.state === "waiting")
  if (newest !== undefined) rows.push({
    id: "newest", label: `Newest waiting decision: ${newest.subject}`, caption: "Console", glyph: "Tray",
    address: hashOf({ kind: "inbox", decisionId: newest.id }),
    action: { kind: "go", route: { kind: "inbox", decisionId: newest.id } },
  })
  return rows
}
