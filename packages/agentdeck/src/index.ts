/**
 * agentdeck - the middle-abstraction control plane over mainstream agents.
 * Layers: types -> config (unified map) -> consent (session->consent map) ->
 * gateway/adapters (flow control) -> registry (deck).
 */
export * from "./kinds.ts"
export * from "./flow.ts"
export * from "./consent-types.ts"
export * from "./config-types.ts"
export { normalizeConfig, unifiedKinds } from "./config.ts"
export { makeConsentLedger } from "./consent.ts"
export { AgentDeck } from "./registry.ts"
export { effectGateway } from "./adapters/effect.ts"
export { makeDemoGateway } from "./adapters/demo.ts"
export { makeEffectOpsGateway } from "./adapters/effect-ops.ts"
export { makeClaudeSdkGateway } from "./adapters/claude-sdk.ts"
export { makeCliGateway } from "./adapters/cli.ts"
export { cliPresets, cliInvocation } from "./adapters/cli-preset.ts"
export { discoverSessions, sessionSources, discoveryKinds, DEFAULT_LIMIT, remoteSessions, COLLECTOR } from "./discover/index.ts"
export type { DiscoveredSession, DiscoverOptions, SessionSource, RemoteDiscovery } from "./discover/index.ts"
export { makeSshTransport, sshArgs, quote } from "./remote/index.ts"
export type { RemoteTarget, RemoteTransport, RemoteRun, RemoteRunOptions } from "./remote/index.ts"
export { makeLauncher, makeLocalLauncher, makeRemoteLauncher, launchCommand, launchLine, configFor } from "./launch/index.ts"
export type { Launcher, LaunchRequest, LaunchConfig, LaunchCommand, LaunchOutcome, LauncherOptions } from "./launch/index.ts"
export { probeMachine, which, version, installPlan, installPlans, installableKinds, describeInstall } from "./probe/index.ts"
export type {
  MachineFacts, AgentFacts, ProviderFacts, McpServerFacts, PermissionFacts, ProbeOptions, CredentialState,
  AgentInstallPlan, PackageManager
} from "./probe/index.ts"
