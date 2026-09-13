/**
 * The view's live state: what it starts as, and what keeps it fed.
 *
 * One store per mount, seeded from the *view's* state and not the current
 * screen's, because a screen is a place inside a view — the data the view
 * declared does not change when the reader walks into one, and a store rebuilt
 * per screen would throw away every draft on the way. A screen's parameters are
 * the one thing that does change, and they are written into this same store
 * under their own reserved root (see screen.ts), so a screen still reads them
 * with the language's ordinary `{ state: ... }`.
 */

import * as React from "react"
import { createStateStore, type StateStore } from "@json-render/core"
import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { NAV_ROOT } from "@effect-agent/effect-ui"
import { initialStatus } from "@effect-agent/effect-ui/source-status"
import { loadSource } from "./effect-ui-source-runtime.ts"

/**
 * The declared state, with every source's status alongside it. Seeding here
 * rather than in each view is what makes the first paint honest: a source reads
 * as loading from the moment the view renders, instead of reading as an empty
 * list until its first answer arrives. `_nav` starts empty for the same reason —
 * the first screen has no parameters, and a `visible` that reads a parameter
 * should read a missing one rather than read through a missing root.
 */
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
  React.useEffect(() => {
    const timers: number[] = []
    for (const source of sources) {
      const load = () => void loadSource(source, store, fetcher)
      load()
      if (source.refreshMs !== undefined) timers.push(window.setInterval(load, source.refreshMs))
    }
    return () => timers.forEach((timer) => window.clearInterval(timer))
  }, [sources, store, fetcher])
  return null
}
