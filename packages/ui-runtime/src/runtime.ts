import type { UICommand, UIEvent } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import { makeActions, type NavigationState } from "./actions.ts"
import { resolveCanvas, type ResolvedUITree } from "./index.ts"
import { makeUIDataStore, type UIDataStore } from "./data.ts"

export interface UIRuntime {
  readonly apply: (command: UICommand) => void
  readonly dispatch: (event: UIEvent) => Promise<void>
  readonly navigation: () => NavigationState
  readonly view: (state?: Record<string, unknown>) => ResolvedUITree
  readonly viewCanvas: (canvasId: string, state?: Record<string, unknown>) => ResolvedUITree
  readonly version: (canvasId: string) => number
  readonly theme: () => string
  readonly setTheme: (theme: string) => void
  readonly renderer: () => string
  readonly setRenderer: (renderer: string) => void
  readonly data: () => UIDataStore
}

export interface UIRuntimeOptions { readonly onCommand?: (command: UICommand) => void; readonly data?: UIDataStore }

export const makeUIRuntime = (store: DefinitionStore, initialCanvas: string, options: UIRuntimeOptions = {}): UIRuntime => {
  const actions = makeActions(initialCanvas)
  const data = options.data ?? makeUIDataStore()
  let activeTheme = "default"
  let activeRenderer = "web-html"
  return {
    apply: (command) => {
      if (command.kind === "set-theme") { activeTheme = command.theme; options.onCommand?.(command); return }
      if (command.kind === "set-renderer") { activeRenderer = command.renderer; options.onCommand?.(command); return }
      if (command.kind === "navigate") { actions.navigate(command.canvasId, command.params); options.onCommand?.(command); return }
      store.apply(command)
      options.onCommand?.(command)
    },
    dispatch: (event) => actions.dispatch(event),
    navigation: actions.navigation,
    view: (state = {}) => {
      const nav = actions.navigation()
      return resolveCanvas(store, nav.current, { ...data.snapshot(), ...state, ...nav.params }, state)
    },
    viewCanvas: (canvasId, state = {}) => resolveCanvas(store, canvasId, { ...data.snapshot(), ...state }),
    version: (canvasId) => store.getCanvas(canvasId)?.version ?? 0,
    theme: () => activeTheme,
    setTheme: (theme) => {
      activeTheme = theme
      options.onCommand?.({ kind: "set-theme", theme })
    },
    renderer: () => activeRenderer,
    setRenderer: (renderer) => {
      activeRenderer = renderer
      options.onCommand?.({ kind: "set-renderer", renderer })
    },
    data: () => data
  }
}
