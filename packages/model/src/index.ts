/**
 * @effect-agent/model — L1 model layer
 *
 * Model contract (wire types + capabilities), openai/anthropic providers,
 * configuration catalog (TOML/env → Model), and M1 Tag + Layer assembly.
 * The builtin loop takes its Model from here; this package knows nothing
 * about any layer above it.
 */
export * from "./types.ts"
export * from "./service.ts"
export * from "./openai.ts"
export * from "./anthropic.ts"
export * from "./catalog.ts"
