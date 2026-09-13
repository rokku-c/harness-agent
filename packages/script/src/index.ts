/**
 * @effect-agent/script — capability script sandbox (recursive bootstrap)
 *
 * The API available inside the sandbox = the toolcall set exported to the agent; scripts compose
 * existing toolcalls to implement higher-level toolcalls (defineTool bootstrap; the api set grows).
 * Three mechanisms under the "scope + policy" pattern:
 *   visibleTools  = dependency-closure visibility (scope + closure)
 *   VersionStore  = content-addressed versions (hash locks the dependency closure; strong/weak deps)
 *   mergePolicy / restrictPolicy = isomorphic system/agent config + derived narrowing
 *
 * The fourth, compatibility adjudication, is @effect-agent/effect-compat's, which
 * a Policy carries and this package reads; it is not re-exported from here.
 */
export * from "./types.ts"
export * from "./closure.ts"
export * from "./version.ts"
export * from "./policy.ts"
export * from "./sandbox.ts"
