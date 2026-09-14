import type { ParityAction } from "./types.ts"

export interface ParitySubmitResult {
  readonly name: string
  readonly args: unknown
}

export type ParityActionsSource = { readonly actions: readonly ParityAction[] }

export const submitAction = (
  source: ParityActionsSource,
  name: string,
  args: unknown,
): ParitySubmitResult => {
  const action = source.actions.find((a) => a.name === name)
  if (action === undefined) throw new Error(`not an agent action: ${name}`)
  return { name: action.name, args }
}
