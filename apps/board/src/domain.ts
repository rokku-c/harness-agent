/**
 * Barrel: apps/board domain (layer 1 - pure model + invariants, no IO),
 * split by CONCEPT (see ./domain/). resources.ts = what the board governs;
 * work.ts = work items as data; executors.ts = the multi-agent surface;
 * views.ts = column projections; machine.ts = the state machine table.
 */
export type { ResourceKind, Concurrency, Resource, ResourceClaim } from "./domain/resources.ts"
export { WORK_ITEM_STATES } from "./domain/work.ts"
export type { WorkItemState, Priority, WorkItemKind, WorkItem } from "./domain/work.ts"
export { TreeInvariantError, isLeaf, assertParent, attachChild, descendants, dependenciesReady, unblockDependents } from "./domain/task-tree.ts"
export { rollup } from "./domain/rollup.ts"
export type { Rollup } from "./domain/rollup.ts"
export type { ExecutorKind, Executor } from "./domain/executors.ts"
export type { AgentChannel, AgentStatus, IsolationLevel, AgentCapabilities, AgentInstance } from "./domain/agents.ts"
export { supportsLaunch, isOffline } from "./domain/agents.ts"
export type { LaunchMode, MergePolicy, VerifyPolicy, ExecutionStatus, RunPolicy, LaunchIntent, ExecutionRecord } from "./domain/execution.ts"
export { canRetry } from "./domain/execution.ts"
export type { ViewColumn, BoardView } from "./domain/views.ts"
export type { Transition } from "./domain/machine.ts"
export { TRANSITIONS, canTransition } from "./domain/machine.ts"
