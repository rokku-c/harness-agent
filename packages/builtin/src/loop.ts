/**
 * Barrel: the effect-agent driver split by CONCEPT (see ./loop/).
 * Layer order: types -> protocol -> semantics/decide -> driver.
 * External importers keep using this path - nothing else changes.
 */
export { EffectAgent } from "./loop/driver.ts"
export type { LoopState, EffectAgentOptions } from "./loop/types.ts"
