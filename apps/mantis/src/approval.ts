import { Effect } from "effect"
import type { GateDecision, GateService } from "@effect-agent/gate"
import type { Op } from "@effect-agent/core"

export interface ApprovalRequest {
  readonly tool: string
  readonly input: unknown
  readonly access: "read" | "write"
  readonly session?: string
}

export interface ApprovalPolicy {
  readonly requires: (request: ApprovalRequest) => boolean
  readonly ask: (request: ApprovalRequest, timeoutMs?: number) => Effect.Effect<GateDecision>
}

export const noApproval: ApprovalPolicy = {
  requires: () => false,
  ask: () => Effect.succeed({ _tag: "Allow" } as GateDecision)
}

export const gateApproval = (
  gate: GateService,
  requires: ApprovalPolicy["requires"],
  timeoutMs?: number
): ApprovalPolicy => ({
  requires,
  ask: (request, ms) =>
    gate.request(
      { tool: request.tool, input: request.input, access: request.access, session: request.session },
      ms ?? timeoutMs
    )
})

export const withApproval = <I, O, R>(op: Op<I, O, never, R>, policy: ApprovalPolicy): Op<I, O, Error, R> => ({
  ...op,
  execute: (input: I) =>
    Effect.gen(function* () {
      const request: ApprovalRequest = { tool: op.name, input, access: op.access }
      if (!policy.requires(request)) return yield* op.execute(input)
      const verdict = yield* policy.ask(request)
      if (verdict._tag === "Deny") return yield* Effect.fail(new Error(verdict.reason))
      return yield* op.execute(input)
    })
})
