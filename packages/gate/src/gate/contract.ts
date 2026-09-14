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
  readonly decide: (input: GateInput) => Effect.Effect<GateDecision>
  readonly request: (input: GateInput, timeoutMs?: number) => Effect.Effect<GateDecision>
}

export class Gate extends Context.Tag("effect-agent/Gate")<Gate, GateService>() {}

export const keyOf = (input: GateInput): string =>
  JSON.stringify([input.tool, input.access, input.session ?? null, input.input])
