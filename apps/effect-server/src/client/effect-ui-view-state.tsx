import * as React from "react"
import { createStateStore, type StateStore } from "@json-render/core"
import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { NAV_ROOT } from "@effect-agent/effect-ui"
import { initialStatus } from "@effect-agent/effect-ui/source-status"
import { loadSource } from "./effect-ui-source-runtime.ts"
import { useReadNow } from "./console-read-now.ts"

const seeded = (state: Record<string, unknown> | undefined, sources: readonly UiSourceSpec[]): Record<string, unknown> => ({
  ...state,
  [NAV_ROOT]: {},
  _sources: Object.fromEntries(sources.map((source) => [source.id, initialStatus()])),
})

export const useViewStore = (state: Record<string, unknown> | undefined, sources: readonly UiSourceSpec[]): StateStore => {
  const ref = React.useRef<StateStore | null>(null)
  if (ref.current === null) ref.current = createStateStore(seeded(state, sources))
  return ref.current
}

export const SourceLoader = ({ sources, store, fetcher }: { readonly sources: readonly UiSourceSpec[]; readonly store: StateStore; readonly fetcher: typeof fetch }) => {
  const read = useReadNow()
  React.useEffect(() => {
    const timers: number[] = []
    for (const source of sources) {
      const load = () => void loadSource(source, store, fetcher)
      load()
      if (source.refreshMs !== undefined) timers.push(window.setInterval(load, source.refreshMs))
    }
    return () => timers.forEach((timer) => window.clearInterval(timer))
  }, [sources, store, fetcher, read])
  return null
}
