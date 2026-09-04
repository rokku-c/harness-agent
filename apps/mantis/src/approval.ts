/**
 * Approval policy: the explicit seam between "a tool executes" and "a human
 * must first say yes". Deliberately NOT implied by access=write - protecting
 * a call is an explicit choice (noApproval is the default), and the verdict
 * mechanism (a gate, a chat with the owner, ...) is pluggable.
 */
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
  /** does this exact call need a human before it runs? */
  readonly requires: (request: ApprovalRequest) => boolean
  /** how the verdict for a protected call is obtained */
  readonly ask: (request: ApprovalRequest, timeoutMs?: number) => Effect.Effect<GateDecision>
}

/** nothing is protected - every tool executes (the default policy) */
export const noApproval: ApprovalPolicy = {
  requires: () => false,
  ask: () => Effect.succeed({ _tag: "Allow" } as GateDecision)
}

/**
 * Protect exactly the calls requires() picks; verdicts go through a gate.
 * The gate is the operator console: it must Ask for every call that reaches
 * it, so pair it with a ManualGate configured as an operator console:
 * new ManualGate(() => true) - the requires() filter above is what decides
 * which calls ever reach the console.
 */
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

/** wrap an op so protected calls wait on the policy; Deny fails the tool */
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
