/**
 * Barrel: MantisHost split by CONCEPT (see ./host/).
 * contract.ts = options/approval types; policy.ts = per-conversation
 * approval adapter; sessions.ts = the session registry; queue.ts = turn
 * serialization + failure digestion; class.ts = the facade + wiring.
 */
export type { MantisHostApproval, MantisHostOptions } from "./host/contract.ts"
export { MantisHost } from "./host/class.ts"
