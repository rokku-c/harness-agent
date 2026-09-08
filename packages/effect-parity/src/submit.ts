/**
 * submitAction — resolve one action invocation against a parity view.
 *
 * The UI calls the SAME tool an agent would; here we validate that the action
 * is genuinely one of the agent's actions (parity), returning its resolved
 * name + args so the caller can drive app_call elsewhere. Unknown names throw
 * "not an agent action".
 */

import type { ParityAction } from "./types.ts"

export interface ParitySubmitResult {
  readonly name: string
  readonly args: unknown
}

/** Anything carrying the parity action set: a full view, a spec, a frame. */
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
