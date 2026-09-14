/**
 * §6.4's last two groups: the open app's declared actions, and the console's own.
 *
 * **Actions.** Two rules from §6.3 and §6.4 meet here, and both are refusals. An
 * action that needs arguments never runs from the palette (rule 2), so a row with
 * declared `params` points at the control that supplies them instead — the screen
 * that holds it is found by looking for the element whose press names the action,
 * which is a fact about the lowered spec and not a second declaration the app
 * would have to keep in step. And no destructive action is one keystroke, so a
 * row runs an action only when it makes no write at all: a read (`GET`) or a
 * refresh is safe to repeat, and everything that posts, patches or deletes goes
 * to its own screen, where its confirmation is.
 *
 * Those two together decide the group, and they also decide what cannot be in it:
 * the declarations carry no "destructive" flag yet, so "is this a write" is the
 * only signal there is, and it refuses a few actions that would have been fine to
 * run. That is the direction to be wrong in. The gap is a missing declaration,
 * not a missing rule.
 *
 * **Console.** §6.4 lists six entries. Five are here. The sixth, "clear the Inbox
 * count", is not: the count is chrome that does not exist yet, and a row that
 * cleared a number nothing draws would be a control with no effect — the kind of
 * row this whole file exists to keep out.
 */

import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { hashOf } from "./console-nav.ts"
import { modKey } from "./console-keys.ts"
import { THEME_MODES, themeLabel } from "./theme-runtime.ts"
import type { CommandRow, PaletteInput } from "./console-commands.ts"
import type { UiActionSpec } from "@effect-agent/effect-ui"
import type { ViewPayload } from "./console-view-read.ts"

/** Whether the palette may run this action rather than point at the control that supplies it. */
const runsFromHere = (action: UiActionSpec): boolean =>
  (action.params === undefined || Object.keys(action.params).length === 0) &&
  (action.url === undefined || action.method === "GET")

/**
 * The action a lowered element presses, read through the library's own element
 * type: the console is the thing that put `on.press` there (`packages/effect-ui`'s
 * `json-spec.ts`), and the one field is read structurally rather than by widening
 * the spec types the whole renderer is typed by.
 */
const pressedBy = (element: unknown): string | undefined => {
  const on = (element as { on?: { press?: { action?: unknown } } }).on
  return typeof on?.press?.action === "string" ? on.press.action : undefined
}

/** The screen whose spec holds a control for this action, which is where a reader must go to fill it in. */
const holderOf = (view: ViewPayload, name: string): string | undefined =>
  view.screens.find((screen) => Object.values(screen.spec.elements).some((element) => pressedBy(element) === name))?.id

export const actionRows = ({ plan, view, open }: PaletteInput): readonly CommandRow[] => {
  // Only the mounted app's actions can be run, and only its payload offers them
  // (`console-action-registry.ts`). A query that names another app moves the
  // screens this palette shows, and must not move what it can do.
  if (view === undefined || open === undefined || view.id !== open) return []
  const title = plan.find((entry) => entry.id === view.id)?.title ?? view.id
  return (view.actions ?? []).flatMap((action): readonly CommandRow[] => {
    const row = { id: `action/${view.id}/${action.name}`, label: action.name, caption: `Action · ${title}`, glyph: "Check", owner: view.id }
    if (runsFromHere(action)) return [{ ...row, action: { kind: "run", app: view.id, name: action.name } }]
    const screen = holderOf(view, action.name)
    // Declared but nowhere pressed: there is no control to send a reader to, and a row
    // that went to the app anyway would leave them looking for one.
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
  // The key printed here is the one the registry binds (`console-keys.ts`): a row
  // advertising a key the dispatcher does not answer would be a sheet teaching a
  // key that does nothing, one layer up.
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
