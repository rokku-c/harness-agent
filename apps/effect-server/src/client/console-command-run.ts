import * as React from "react"
import { navigate } from "./console-nav.ts"
import { readNow } from "./console-read-now.ts"
import { runMountedAction } from "./console-action-registry.ts"
import { copyDeepLink } from "./console-deep-link.ts"
import type { CommandRow } from "./console-commands.ts"
import type { ThemeMode } from "./theme-runtime.ts"

export interface CommandRunner {
  readonly run: (row: CommandRow) => void
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
