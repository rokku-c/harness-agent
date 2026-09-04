/**
 * Barrel: versioning split by CONCEPT (see ./version/).
 * address.ts = canonical content + SHA-256 hashing; store.ts = the version
 * chain and ref resolution (latest/revision/hash/range).
 */
export { canonical, hashVersion } from "./version/address.ts"
export { VersionStore, refLabel } from "./version/store.ts"
