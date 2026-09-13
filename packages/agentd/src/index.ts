export * from "./types.ts"
export * from "./node-types.ts"
export * from "./contract.ts"
export * from "./errors.ts"
export { makeAgentdControl } from "./control.ts"
export type { AgentdControlOptions } from "./control-state.ts"
export { makeLaunchQueue } from "./launches.ts"
export type { LaunchQueue, LaunchQueueOptions } from "./launches.ts"
export type { LaunchIntent, LaunchRequest, LaunchState } from "./launch-types.ts"
export { makeFactsRegistry } from "./facts.ts"
export type { FactsRegistry, FactsRegistryOptions, MachineReport } from "./facts.ts"
export type { LocatedSession, SessionQuery, SessionRecord } from "./facts-sessions.ts"
export { makeTunnel } from "./tunnel.ts"
export type { Tunnel, TunnelOptions, TunnelSend, TunnelUpstream } from "./tunnel.ts"
export { makeNodePresence } from "./presence-table.ts"
export { sameToken } from "./same-token.ts"
export type { LeaseClock, NodePresence, NodePresenceOptions, NodePresenceTable } from "./presence.ts"

export { makeGatewayConfigAdapter } from "./adapter.ts"
export type { GatewayAgentConfig } from "./adapter.ts"

export { assessBundleForMachine, bundleRefId, kernelRevisionOf } from "./bundles.ts"
export { machineCapability } from "./machine-capability.ts"
export type { MachineCapability } from "./machine-capability.ts"
export { makeBundleArtifactAdapter } from "./bundle-adapter.ts"
export type { BundleAgentConfig, BundleArtifact } from "./bundle-artifact.ts"

export { makeNodeArtifactAdapter } from "./node-adapter.ts"
export { nodeAppId } from "./node-placement.ts"
export type { NodeAppArtifact } from "./node-placement.ts"
export { validateNodeDeployment } from "./nodes.ts"
export type { NodeAdapter, NodeAdapterPlan, NodeDeployment } from "./nodes.ts"

/** §8.3: what a node says it carries, and whether a deployment fits inside it. */
export { admitApps, requirableRuntimes } from "./capacity.ts"
export type { DeclaredCapacity } from "./capacity.ts"

/** §8.2/P6: a published version's bytes — the store, the listing, and the wire. */
export { listingDigest, readListing } from "./artifact-listing.ts"
export type { ArtifactFile, ArtifactListing } from "./artifact-listing.ts"
export { makeArtifactStore } from "./artifacts.ts"
export type { ArtifactStore } from "./artifacts.ts"
export { fromWire, toWire } from "./artifact-wire.ts"
export type { DecodedArtifact, WireArtifact, WireFile } from "./artifact-wire.ts"
export { makeBundleRegistry } from "./bundle-registry.ts"
export type { BundleRegistry } from "./bundle-registry.ts"

/** Key-order-independent equality — what a plan diff and a "did this change" both need. */
export { same, stableString } from "./stable.ts"
