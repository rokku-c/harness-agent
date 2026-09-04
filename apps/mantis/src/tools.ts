/**
 * Barrel: the mantis domain tools split by CONCEPT (see ./tools/).
 * contract.ts = entry shape + limits; store.ts = the shared durable
 * workspace; schemas.ts = shared op contracts + deps; build/ = one domain
 * builder per file (catalog/enable, records, ui, appends); ops.ts =
 * makeMantisOps assembly (surface = manifest order).
 */
export { MAX_RECORD_TEXT, overRecordLimit } from "./tools/contract.ts"
export type { EntrySource, Entry } from "./tools/contract.ts"
export type { NotesStoreOptions } from "./tools/store.ts"
export { NotesStore } from "./tools/store.ts"
export type { MantisToolsDeps } from "./tools/schemas.ts"
export { makeMantisOps } from "./tools/ops.ts"
