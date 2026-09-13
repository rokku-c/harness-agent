/**
 * @effect-agent/effect-compat — the shared compatibility adjudication.
 *
 * One graded model (schema / deps / description / behavior × strict / warn /
 * ignore) used by every upgradeable artifact in the platform: script tools,
 * kernel versions, and app generations. Extracted from the script sandbox so
 * that depending on the adjudication does NOT mean depending on the sandbox
 * (which pulls a native module).
 */
export * from "./policy.ts"
export * from "./assess.ts"
export * from "./assess-types.ts"
export * from "./assess-chain.ts"
