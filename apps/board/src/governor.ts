/**
 * Barrel: the ResourceGovernor split by CONCEPT (see ./governor/).
 * types.ts = priority/wait-entries/holdings contract; claims.ts = pure
 * fitness + commit/remove holdings rules; queue.ts = waiter ordering;
 * class.ts = the ResourceGovernor state machine over them.
 */
export { ResourceGovernor } from "./governor/class.ts"
export type { Priority, WaitEntry, Holdings } from "./governor/types.ts"
