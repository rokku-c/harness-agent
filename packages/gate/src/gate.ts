/**
 * Barrel: the approval layer split by CONCEPT (see ./gate/).
 * contract.ts = GateDecision/input/service; policies.ts = pure instant
 * gates; ledger.ts = pending queue + verdicts + subscribers; manual.ts =
 * the operator console (ManualGate) sleeping/waking on Asks.
 */
export type { GateDecision, GateInput, GateService } from "./gate/contract.ts"
export type { PendingApproval } from "./gate/ledger.ts"
export { keyOf, Gate } from "./gate/contract.ts"
export { AllowAllGate, DenyWritesGate } from "./gate/policies.ts"
export { ApprovalLedger } from "./gate/ledger.ts"
export { ManualGate } from "./gate/manual.ts"
