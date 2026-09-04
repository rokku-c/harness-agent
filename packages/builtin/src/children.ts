/**
 * Barrel: the child kernel split by CONCEPT (see ./children/).
 * types.ts = shapes + exit semantics; kernel.ts = the registry-backed
 * implementation. Importers keep using this path.
 */
export type { ChildState, ChildKernel } from "./children/types.ts"
export { childSummary, exitToResult } from "./children/types.ts"
export { makeChildKernel } from "./children/kernel.ts"
