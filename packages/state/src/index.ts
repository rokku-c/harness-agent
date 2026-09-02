/**
 * @effect-agent/state — L2 state layer
 *
 * Fact source separated from projections: EventLog (append-only,
 * model-visible ⟺ logged) is the fact source; Store (swappable
 * implementation) carries projections and persistence; Checkpoint is the
 * storage grounding of the core protocol. This package depends on core
 * (protocol/HarnessEvent) and is used by memory/assembly.
 */
export * from "./store.ts"
export * from "./eventlog.ts"
export * from "./checkpoint.ts"
