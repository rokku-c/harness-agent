/**
 * What pressing a row does, and the one fact the palette needs afterwards.
 *
 * §6.4's seven kinds of row reduce to three moves, and the difference between them
 * is what the reader loses. A row that goes somewhere navigates, and the route
 * change is what puts focus on the new heading (§6.2 rule 2) — so the palette must
 * *not* restore focus to its opener, which is exactly what `navigated` is for. A
 * row that only acts — an appearance, a refresh, a copy, a declared action — leaves
 * the reader where they were, so focus goes back to the control that opened the
 * palette (rule 5). The sheet is the third: it replaces this layer rather than
 * closing it, and the opener stays the control that opened the palette, so closing
 * the sheet lands where the reader started.
 *
 * Two rows are refusals by construction rather than by check. A destructive
 * command is never offered as one that runs, so nothing here has to remember not
 * to; and an action that needs arguments is never offered as one that runs either
 * (`console-command-console.ts`). What is left is a `run` whose action the mounted
 * view has already agreed to (`console-action-registry.ts`) — which is also why
 * the copy is fired and forgotten: the console's live region announces four things
 * and a copy is not one of them (`console-deep-link.ts`).
 */

import * as React from "react"
import { navigate } from "./console-nav.ts"
import { readNow } from "./console-read-now.ts"
import { runMountedAction } from "./console-action-registry.ts"
import { copyDeepLink } from "./console-deep-link.ts"
import type { CommandRow } from "./console-commands.ts"
import type { ThemeMode } from "./theme-runtime.ts"

export interface CommandRunner {
  readonly run: (row: CommandRow) => void
  /** Whether the palette has navigated. Read once, on the way out. */
  readonly navigated: React.RefObject<boolean>
}

export const useCommandRun = (
  onClose: () => void,
  onShortcuts: () => void,
  setTheme: (mode: ThemeMode) => void,
): CommandRunner => {
  const navigated = React.useRef(false)
  const run = React.useCallback((row: CommandRow): void => {
    switch (row.action.kind) {
      case "go": navigated.current = true; onClose(); navigate(row.action.route); return
      case "appearance": setTheme(row.action.mode); onClose(); return
      case "read": readNow(); onClose(); return
      case "copy": void copyDeepLink().then(() => onClose()); return
      case "run": runMountedAction(row.action.app, row.action.name); onClose(); return
      case "shortcuts": onShortcuts(); return
    }
  }, [onClose, onShortcuts, setTheme])
  return { run, navigated }
}
