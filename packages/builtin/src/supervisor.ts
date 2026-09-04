/**
 * Barrel: the supervisor capability split by CONCEPT (see ./supervisor/).
 * lifecycle.ts = fork/join/resume ops; child-ops.ts = per-child verbs;
 * bindings.ts = the runtime/child surface compositions.
 */
export { spawnOps } from "./supervisor/lifecycle.ts"
export { signalOps } from "./supervisor/child-ops.ts"
export { runtimeBinding, childBinding } from "./supervisor/bindings.ts"
