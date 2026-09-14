import * as React from "react"
import { useReadNow } from "./console-read-now.ts"
import { announce } from "./console-live.ts"

export type SourceState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T; readonly at: number }
  /** `value` is the last success, kept so a failed read never blanks the rows it had. */
  | { readonly status: "failed"; readonly error: string; readonly at?: number; readonly value?: T }

export const useSource = <T,>(key: string, load: (key: string) => Promise<T>) => {
  const [state, setState] = React.useState<SourceState<T>>({ status: "loading" })
  const [attempt, setAttempt] = React.useState(0)
  const read = useReadNow()
  React.useEffect(() => {
    let live = true
    void load(key).then(
      (value) => { if (live) setState({ status: "ready", value, at: Date.now() }) },
      (cause: Error) => {
        if (!live) return
        announce(`Reading ${key} failed: ${cause.message}`)
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

export const readAt = (at: number): string => new Date(at).toLocaleTimeString()

export const sourceValue = <T,>(state: SourceState<T>): T | undefined =>
  state.status === "ready" ? state.value : state.status === "failed" ? state.value : undefined
