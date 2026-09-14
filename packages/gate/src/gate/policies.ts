import { Effect } from "effect"
import type { GateDecision, GateInput, GateService } from "./contract.ts"

export const AllowAllGate: GateService = {
  decide: () => Effect.succeed({ _tag: "Allow" } as GateDecision),
  request: (_input, _timeoutMs) => Effect.succeed({ _tag: "Allow" } as GateDecision)
}

export const DenyWritesGate = (allowedSessions: ReadonlyArray<string>): GateService => ({
  decide: (input) =>
    Effect.sync(() => {
      if (input.access === "write" && !allowedSessions.includes(input.session ?? ""))
        return { _tag: "Deny", reason: "write operation not authorized" } as GateDecision
      return { _tag: "Allow" } as GateDecision
    }),
  request: (input, _timeoutMs) => DenyWritesGate(allowedSessions).decide(input)
})
