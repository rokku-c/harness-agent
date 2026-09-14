import * as React from "react"
import { isView, loadView, type ViewPayload } from "./console-view-read.ts"
import { loadTools } from "./console-tools-read.ts"
import { loadInbox, type Decision } from "./console-decision.ts"
import type { InspectorPayload } from "./inspector-types.ts"

const NO_APPS: readonly InspectorPayload[] = []
const NO_DECISIONS: readonly Decision[] = []

const useRead = <T,>(load: () => Promise<T>, empty: T): T => {
  const [value, setValue] = React.useState<T>(empty)
  React.useEffect(() => {
    let live = true
    void load().then((read) => { if (live) setValue(read) }, () => { if (live) setValue(empty) })
    return () => { live = false }
  }, [load, empty])
  return value
}

export const useOpenView = (id: string | undefined): ViewPayload | undefined => {
  const [view, setView] = React.useState<ViewPayload | undefined>(undefined)
  React.useEffect(() => {
    if (id === undefined) { setView(undefined); return }
    let live = true
    void loadView(id).then((read) => { if (live) setView(isView(read) ? read : undefined) }, () => { if (live) setView(undefined) })
    return () => { live = false }
  }, [id])
  return view
}

export const useOperations = (): readonly InspectorPayload[] =>
  useRead(React.useCallback(() => loadTools().then((catalogue) => catalogue.apps), []), NO_APPS)

export const useWaitingDecisions = (): readonly Decision[] =>
  useRead(React.useCallback(() => loadInbox().then((snapshot) => snapshot.decisions), []), NO_DECISIONS)
