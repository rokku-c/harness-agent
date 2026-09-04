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
}

export const makeUIRuntime = (store: DefinitionStore, initialCanvas: string): UIRuntime => {
  const actions = makeActions(initialCanvas)
  return {
    apply: (command) => {
      store.apply(command)
    },
    dispatch: (event) => actions.dispatch(event),
    navigation: actions.navigation,
    view: (state = {}) => resolveCanvas(store, actions.navigation().current, state),
    viewCanvas: (canvasId, state = {}) => resolveCanvas(store, canvasId, state),
    version: (canvasId) => store.getCanvas(canvasId)?.version ?? 0
  }
}
