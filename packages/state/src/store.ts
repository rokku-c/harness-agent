/**
 * Barrel: the state Store split by CONCEPT (see ./store/).
 * contract.ts = the seam shape + row metadata rule; memory.ts = in-memory
 * default; durable production implementation lives in storage-typeorm.
 */
export type { QuerySpec, StoredValue, StoreService } from "./store/contract.ts"
export { deriveMeta, Store } from "./store/contract.ts"
export { MemoryStore, MemoryStoreLayer } from "./store/memory.ts"
