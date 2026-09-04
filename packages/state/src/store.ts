/**
 * Barrel: the state Store split by CONCEPT (see ./store/).
 * contract.ts = the seam shape + row metadata rule; memory.ts = in-memory
 * default; jsonl.ts = append-only file implementation.
 */
export type { QuerySpec, StoreService } from "./store/contract.ts"
export { Store } from "./store/contract.ts"
export { MemoryStore, MemoryStoreLayer } from "./store/memory.ts"
export { JsonlStore, JsonlStoreLayer } from "./store/jsonl.ts"
