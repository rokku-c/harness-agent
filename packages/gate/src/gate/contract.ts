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

/**
 * The identity of one request, for remembering a verdict under it.
 *
 * Every field `GateInput` carries is part of the identity, because a recorded
 * verdict is returned before `askWhen` is consulted: whatever this key leaves
 * out is a way for one call to be answered by another's approval. `session` is
 * what makes an approval belong to the conversation that asked for it - the
 * host shares one `ManualGate` and stamps the conversation here - and `access`
 * is what keeps an approved read from answering a write.
 *
 * Built by `JSON.stringify` of a tuple rather than by joining with a separator:
 * a field may contain the separator, and then two requests fold onto one key.
 */
export const keyOf = (input: GateInput): string =>
  JSON.stringify([input.tool, input.access, input.session ?? null, input.input])
