import type { ActionRef, UIEvent } from "@effect-agent/ui-protocol"

export interface NavigationState { readonly current: string; readonly stack: ReadonlyArray<string> }
export interface RuntimeActions {
  readonly navigation: () => NavigationState
  readonly dispatch: (event: UIEvent) => Promise<void>
}

export const makeActions = (initialCanvas: string): RuntimeActions => {
  let current = initialCanvas
  let stack: string[] = []
  const navigation = (): NavigationState => ({ current, stack: [...stack] })
  const run = async (action: ActionRef): Promise<void> => {
    if (action.action === "navigate_to_canvas") {
      const target = action.input?.canvasId
      if (typeof target !== "string") throw new Error("navigate_to_canvas needs canvasId")
      stack = [...stack, current]
      current = target
    } else if (action.action === "go_back") {
      const previous = stack.at(-1)
      if (previous !== undefined) { current = previous; stack = stack.slice(0, -1) }
    }
  }
  return {
    navigation,
    dispatch: async (event) => {
      for (const action of event.actions ?? []) await run(action)
    }
  }
}
