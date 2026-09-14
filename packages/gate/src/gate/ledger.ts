import { Effect, Ref } from "effect"
import { randomUUID } from "node:crypto"
import { keyOf, type GateDecision, type GateInput } from "./contract.ts"

export interface PendingApproval {
  readonly callId: string
  readonly input: GateInput
  readonly askedAt: number
}

export class ApprovalLedger {
  private readonly pendingRef = Ref.unsafeMake<ReadonlyArray<PendingApproval>>([])
  private readonly decisionsRef = Ref.unsafeMake(new Map<string, GateDecision>())
  private readonly listeners = new Set<(pending: PendingApproval) => void>()

  readonly onPending = (listener: (pending: PendingApproval) => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly lookup = (input: GateInput): Effect.Effect<GateDecision | undefined> =>
    Effect.map(Ref.get(this.decisionsRef), (map) => map.get(keyOf(input)))

  readonly ask = (input: GateInput): Effect.Effect<PendingApproval> => {
    const pendingRef = this.pendingRef
    const listeners = this.listeners
    return Effect.gen(function* () {
      const approval: PendingApproval = { callId: randomUUID(), input, askedAt: Date.now() }
      yield* Ref.update(pendingRef, (items) => [...items, approval])
      for (const listener of listeners) void listener(approval)
      return approval
    })
  }

  readonly find = (callId: string): Effect.Effect<PendingApproval | undefined> =>
    Effect.map(Ref.get(this.pendingRef), (items) => items.find((item) => item.callId === callId))

  readonly drop = (callId: string): Effect.Effect<void> =>
    Ref.update(this.pendingRef, (items) => items.filter((item) => item.callId !== callId))

  readonly record = (input: GateInput, verdict: GateDecision): Effect.Effect<void> =>
    Ref.update(this.decisionsRef, (map) => {
      const next = new Map(map)
      next.set(keyOf(input), verdict)
      return next
    })

  readonly list = (): Effect.Effect<ReadonlyArray<PendingApproval>> => Ref.get(this.pendingRef)
}
