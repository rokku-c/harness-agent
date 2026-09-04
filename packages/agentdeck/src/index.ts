/**
 * agentdeck - the middle-abstraction control plane over mainstream agents.
 * Layers: types -> config (unified map) -> consent (session->consent map) ->
 * gateway/adapters (flow control) -> registry (deck).
 */
export * from "./types.ts"
export { normalizeConfig, unifiedKinds } from "./config.ts"
export { makeConsentLedger } from "./consent.ts"
export { AgentDeck } from "./registry.ts"
export { effectGateway } from "./adapters/effect.ts"
export { makeDemoGateway } from "./adapters/demo.ts"
export { makeEffectOpsGateway } from "./adapters/effect-ops.ts"
export { makeClaudeSdkGateway } from "./adapters/claude-sdk.ts"
export { makeCliGateway, cliPresets, cliInvocation } from "./adapters/cli.ts"
