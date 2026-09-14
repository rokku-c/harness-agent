/**
 * What the palette reads, and only while it is open.
 *
 * Three of §6.4's eight groups are lists the console does not hold: an app's
 * screens and its declared actions, every registered operation, and the decisions
 * that are waiting. Each is a read of an endpoint the console already serves, and
 * none of them is fetched while the palette is closed — the component that calls
 * these is mounted on the keystroke and unmounted on the next one, so the cost is
 * paid when an operator asks a question and not on every route.
 *
 * A read that fails is an empty list, never an error state. A group of a palette
 * is not a screen: the surface behind this one is where a failed read says so in
 * its own words (§2.H12), and a palette that shouted about it would be shouting
 * about a list the operator did not ask for. The Inbox is the one case worth
 * naming: its read answers 404 today because the store behind it is host work
 * that does not exist yet (`console-decision.ts`), and the Decisions group is
 * empty for that reason and no other.
 */

import * as React from "react"
import { isView, loadView, type ViewPayload } from "./console-view-read.ts"
import { loadTools } from "./console-tools-read.ts"
import { loadInbox, type Decision } from "./console-decision.ts"
import type { InspectorPayload } from "./inspector-types.ts"

/** The three empties are module constants so that a read's dependencies never change under it. */
const NO_APPS: readonly InspectorPayload[] = []
const NO_DECISIONS: readonly Decision[] = []

/** One read of one endpoint, re-run when its subject changes, empty on failure. */
const useRead = <T,>(load: () => Promise<T>, empty: T): T => {
  const [value, setValue] = React.useState<T>(empty)
  React.useEffect(() => {
    let live = true
    void load().then((read) => { if (live) setValue(read) }, () => { if (live) setValue(empty) })
    return () => { live = false }
  }, [load, empty])
  return value
}

/** The open app's screens and declared actions, in one read: they arrive in one payload. */
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

/** Every operation every app registered. A failed read is no operations, which is what the Tools place then says. */
export const useOperations = (): readonly InspectorPayload[] =>
  useRead(React.useCallback(() => loadTools().then((catalogue) => catalogue.apps), []), NO_APPS)

/** The decisions waiting on a human, for the Decisions group. */
export const useWaitingDecisions = (): readonly Decision[] =>
  useRead(React.useCallback(() => loadInbox().then((snapshot) => snapshot.decisions), []), NO_DECISIONS)
