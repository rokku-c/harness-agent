/**
 * Gate: the approval/confirmation seam (E12). Decided BEFORE a tool
 * executes; AllowAll is the open-box default, ManualGate queues Ask
 * decisions for a human/operator, and any policy can replace them.
 */
import { Context, Effect, Ref } from "effect"
import { randomUUID } from "node:crypto"

export type GateDecision =
  | { readonly _tag: "Allow" }
  | { readonly _tag: "Deny"; readonly reason: string }
  | { readonly _tag: "Ask"; readonly prompt: string }

export interface GateInput {
  readonly tool: string
  readonly input: unknown
  readonly access: "read" | "write"
  readonly session?: string
}

export interface GateService {
  readonly decide: (input: GateInput) => Effect.Effect<GateDecision>
}

export class Gate extends Context.Tag("effect-agent/Gate")<Gate, GateService>() {}

/** Default: allow everything - the open-box default (M1). */
export const AllowAllGate: GateService = {
  decide: () => Effect.succeed({ _tag: "Allow" } as GateDecision)
}

/** Policy example: deny all write ops unless a session flag allows them. */
export const DenyWritesGate = (allowedSessions: ReadonlyArray<string>): GateService => ({
  decide: (input) =>
    Effect.sync(() => {
      if (input.access === "write" && !allowedSessions.includes(input.session ?? ""))
        return { _tag: "Deny", reason: "write operation not authorized" } as GateDecision
      return { _tag: "Allow" } as GateDecision
    })
})

export interface PendingApproval {
  readonly callId: string
  readonly input: GateInput
  readonly askedAt: number
}

/** Manual gate: Ask decisions wait for an operator; resolve() answers them. */
export class ManualGate implements GateService {
  private readonly pendingRef = Ref.unsafeMake<ReadonlyArray<PendingApproval>>([])
  private readonly decisionsRef = Ref.unsafeMake(new Map<string, GateDecision>())

  decide = (input: GateInput): Effect.Effect<GateDecision> => {
    const decisionsRef = this.decisionsRef
    const pendingRef = this.pendingRef
    return Effect.gen(function* () {
      const existing = yield* Ref.get(decisionsRef)
      const recorded = existing.get(input.tool + ":" + JSON.stringify(input.input))
      if (recorded !== undefined) return recorded
      if (input.access === "write") {
        const callId = randomUUID()
        yield* Ref.update(pendingRef, (items) => [
          ...items,
          { callId, input, askedAt: Date.now() }
        ])
        return { _tag: "Ask", prompt: "tool " + input.tool + " requests write permission: " + JSON.stringify(input.input) } as GateDecision
      }
      return { _tag: "Allow" } as GateDecision
    })
  }

  /** Operator answers a pending Ask. */
  resolve = (callId: string, allow: boolean): Effect.Effect<void, Error> => {
    const decisionsRef = this.decisionsRef
    const pendingRef = this.pendingRef
    return Effect.gen(function* () {
      const pending = yield* Ref.get(pendingRef)
      const approval = pending.find((item) => item.callId === callId)
      if (approval === undefined) return yield* Effect.fail(new Error("no pending approval " + callId))
      yield* Ref.update(decisionsRef, (map) => {
        const next = new Map(map)
        next.set(
          approval.input.tool + ":" + JSON.stringify(approval.input.input),
          allow ? ({ _tag: "Allow" } as GateDecision) : ({ _tag: "Deny", reason: "operator denied" } as GateDecision)
        )
        return next
      })
      yield* Ref.update(pendingRef, (items) => items.filter((item) => item.callId !== callId))
    })
  }

  listPending = () => Ref.get(this.pendingRef)
}
