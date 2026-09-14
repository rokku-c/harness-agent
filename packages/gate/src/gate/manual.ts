import { Deferred, Effect, Ref } from "effect"
import { ApprovalLedger, type PendingApproval } from "./ledger.ts"
import type { GateDecision, GateInput, GateService } from "./contract.ts"

export class ManualGate implements GateService {
  private readonly ledger = new ApprovalLedger()
  private readonly waitingRef = Ref.unsafeMake(new Map<string, Deferred.Deferred<GateDecision, never>>())
  private readonly askWhen: (input: GateInput) => boolean

  constructor(askWhen: (input: GateInput) => boolean = () => false) {
    this.askWhen = askWhen
  }
  readonly onPending = (listener: (pending: PendingApproval) => void): (() => void) =>
    this.ledger.onPending(listener)

  decide = (input: GateInput): Effect.Effect<GateDecision> => {
    const ledger = this.ledger
    const askWhen = this.askWhen
    return Effect.gen(function* () {
      const recorded = yield* ledger.lookup(input)
      if (recorded !== undefined) return recorded
      if (!askWhen(input)) return { _tag: "Allow" } as GateDecision
      const approval = yield* ledger.ask(input)
      return {
        _tag: "Ask",
        callId: approval.callId,
        prompt: "tool " + input.tool + " requests approval: " + JSON.stringify(input.input)
      } as GateDecision
    })
  }

  request = (input: GateInput, timeoutMs?: number): Effect.Effect<GateDecision> => {
    const gate = this
    return Effect.gen(function* () {
      const decision = yield* gate.decide(input)
      if (decision._tag !== "Ask") return decision
      const waiting = yield* Ref.get(gate.waitingRef)
      let deferred = waiting.get(decision.callId)
      if (deferred === undefined) {
        deferred = yield* Deferred.make<GateDecision, never>()
        yield* Ref.update(gate.waitingRef, (map) => {
          const next = new Map(map)
          next.set(decision.callId, deferred!)
          return next
        })
      }
      const awaited = Deferred.await(deferred)
      const verdict = timeoutMs === undefined
        ? yield* awaited
        : yield* awaited.pipe(
            Effect.timeoutFail({
              duration: timeoutMs,
              onTimeout: () => new Error("approval timed out")
            }),
            Effect.catchAll((error: Error) =>
              Effect.succeed({ _tag: "Deny", reason: error.message } as GateDecision))
          )
      yield* gate.ledger.drop(decision.callId)
      yield* Ref.update(gate.waitingRef, (map) => {
        const next = new Map(map)
        next.delete(decision.callId)
        return next
      })
      return verdict
    })
  }

  resolve = (callId: string, allow: boolean): Effect.Effect<void, Error> => {
    const gate = this
    const ledger = this.ledger
    const waitingRef = this.waitingRef
    return Effect.gen(function* () {
      const approval = yield* ledger.find(callId)
      if (approval === undefined) return yield* Effect.fail(new Error("no pending approval " + callId))
      const verdict: GateDecision = allow
        ? { _tag: "Allow" }
        : { _tag: "Deny", reason: "operator denied" }
      yield* ledger.record(approval.input, verdict)
      const waiting = yield* Ref.get(waitingRef)
      const deferred = waiting.get(callId)
      if (deferred !== undefined) yield* Deferred.succeed(deferred, verdict)
    })
  }

  listPending = (): Effect.Effect<ReadonlyArray<PendingApproval>> => this.ledger.list()
}
