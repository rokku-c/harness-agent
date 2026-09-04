/**
 * gate/contract.ts - the APPROVAL CONTRACT (decide/request/Ask).
 *
 * Concept: what a gate IS - a synchronous policy judgement (decide) plus the
 * full round trip a tool wrapper needs (request: decide, and when the policy
 * says Ask, hang until an operator answers; timeout turns an unanswered Ask
 * into Deny). Ask is opt-in, never implied by access=write.
 */
import { Context, Effect } from "effect"

export type GateDecision =
  | { readonly _tag: "Allow" }
  | { readonly _tag: "Deny"; readonly reason: string }
  | { readonly _tag: "Ask"; readonly callId: string; readonly prompt: string }

export interface GateInput {
  readonly tool: string
  readonly input: unknown
  readonly access: "read" | "write"
  readonly session?: string
}

export interface GateService {
  /** the policy's instantaneous judgement (never waits) */
  readonly decide: (input: GateInput) => Effect.Effect<GateDecision>
  /** decide + wait for the operator when Ask; timed out Asks become Deny */
  readonly request: (input: GateInput, timeoutMs?: number) => Effect.Effect<GateDecision>
}

export class Gate extends Context.Tag("effect-agent/Gate")<Gate, GateService>() {}

/** dedupe key for one identical request, shared by ledger + gate */
export const keyOf = (input: GateInput): string => input.tool + ":" + JSON.stringify(input.input)
