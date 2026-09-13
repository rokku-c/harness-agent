/**
 * Barrel: the approval layer split by CONCEPT (see ./gate/).
 * contract.ts = GateDecision/input/service; policies.ts = pure instant
 * gates; ledger.ts = pending queue + verdicts + subscribers; manual.ts =
 * the operator console (ManualGate) sleeping/waking on Asks.
 *
 * What is exported is what a consumer takes: the service tag and its types, the
 * two instant policies, and `ManualGate` — the one implementation anything
 * outside this package uses. `ApprovalLedger` is `ManualGate`'s own bookkeeping
 * and `keyOf` is the ledger's key, so neither is re-exported; a caller that
 * wants the pending queue asks `ManualGate`, which is the half that also waits
 * and times out.
 */
export type { GateDecision, GateInput, GateService } from "./gate/contract.ts"
export type { PendingApproval } from "./gate/ledger.ts"
export { Gate } from "./gate/contract.ts"
export { AllowAllGate, DenyWritesGate } from "./gate/policies.ts"
export { ManualGate } from "./gate/manual.ts"
