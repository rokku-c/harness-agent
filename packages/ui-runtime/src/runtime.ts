import type { UICommand, UIEvent } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import { makeActions, type NavigationState } from "./actions.ts"
import { resolveCanvas, type ResolvedUITree } from "./index.ts"

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
}

export interface UIRuntimeOptions { readonly onCommand?: (command: UICommand) => void }

export const makeUIRuntime = (store: DefinitionStore, initialCanvas: string, options: UIRuntimeOptions = {}): UIRuntime => {
  const actions = makeActions(initialCanvas)
  let activeTheme = "default"
  let activeRenderer = "web-html"
  return {
    apply: (command) => {
      store.apply(command)
      options.onCommand?.(command)
    },
    dispatch: (event) => actions.dispatch(event),
    navigation: actions.navigation,
    view: (state = {}) => {
      const nav = actions.navigation()
      return resolveCanvas(store, nav.current, { ...state, ...nav.params })
    },
    viewCanvas: (canvasId, state = {}) => resolveCanvas(store, canvasId, state),
    version: (canvasId) => store.getCanvas(canvasId)?.version ?? 0,
    theme: () => activeTheme,
    setTheme: (theme) => { activeTheme = theme },
    renderer: () => activeRenderer,
    setRenderer: (renderer) => { activeRenderer = renderer }
  }
}
