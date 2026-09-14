/**
 * One read, and the three things a reader needs to know about it: whether it has
 * arrived, when it last succeeded, and why it failed.
 *
 * Every surface that reads a source reads it through here, because the two rules
 * the flows put on all of them are the same two rules: `at` is the last success,
 * which is what lets a failure say how old what is on screen is, and a re-read
 * never re-enters the loading state, so live rows are not flashed over (§2,
 * shared state rules). The cursor this keeps per surface is the console's half of
 * `flows.md` §9.13; the intervals a source runs on are the app's own, declared on
 * the view, and are not this file's.
 */

import * as React from "react"
import { useReadNow } from "./console-read-now.ts"

export type SourceState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T; readonly at: number }
  /** `value` is the last success, kept so a failed read never blanks the rows it had. */
  | { readonly status: "failed"; readonly error: string; readonly at?: number; readonly value?: T }

export const useSource = <T,>(key: string, load: (key: string) => Promise<T>) => {
  const [state, setState] = React.useState<SourceState<T>>({ status: "loading" })
  const [attempt, setAttempt] = React.useState(0)
  // `r`, or the palette's `Read now`: every source on the screen reads again, now. It is
  // a dependency and not a call, because which sources are on screen is the screen's question.
  const read = useReadNow()
  React.useEffect(() => {
    let live = true
    void load(key).then(
      (value) => { if (live) setState({ status: "ready", value, at: Date.now() }) },
      (cause: Error) => {
        if (!live) return
        setState((old) => old.status === "ready"
          ? { status: "failed", error: cause.message, at: old.at, value: old.value }
          : { status: "failed", error: cause.message })
      },
    )
    return () => { live = false }
  }, [key, load, attempt, read])
  const retry = React.useCallback(() => setAttempt((count) => count + 1), [])
  return { state, retry }
}

/** The timestamp a marker prints, in the reader's own locale. */
export const readAt = (at: number): string => new Date(at).toLocaleTimeString()

/**
 * What the surface has to show: the value of the last read that succeeded, which
 * survives a read that failed. A surface asks for this rather than for its state,
 * so "keep the last rows" is one behaviour in one place instead of a rule each
 * surface remembers on its own.
 */
export const sourceValue = <T,>(state: SourceState<T>): T | undefined =>
  state.status === "ready" ? state.value : state.status === "failed" ? state.value : undefined
