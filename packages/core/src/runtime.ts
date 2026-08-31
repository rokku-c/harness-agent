import { Context, type Effect, type Option, type Scope } from "effect"
import type { AgentError } from "./errors.ts"
import type { AgentProgram } from "./agent.ts"
import type { Signal } from "./signal.ts"
import type { Boards, Groups } from "./coordination.ts"
import type { ChildResult, ChildSummary, Spawned, Watch } from "./child.ts"

/**
 * The supervision kernel: fork children, talk to them while they run, wait
 * for them. This is the WHOLE runtime surface - coordination structures
 * (boards, groups) are their own services, and progress reporting is pure
 * session protocol (publish to your own session's bus). Small layers stack;
 * nothing here knows about model loops or bindings.
 */
export interface AgentRuntimeService {
  readonly spawn: (agent: string, task: string, watch?: ReadonlyArray<Watch>) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly join: (childId: string) => Effect.Effect<ChildResult, AgentError>
  readonly send: (childId: string, signal: Signal) => Effect.Effect<void, AgentError>
  readonly interrupt: (childId: string, hard?: boolean) => Effect.Effect<void, AgentError>
  /** Checkpoint a running child at its next step boundary. */
  readonly pause: (childId: string) => Effect.Effect<void, AgentError>
  /** Start a fresh run of the checkpointed agent, hydrated from the archive. */
  readonly resume: (runId: string, task?: string) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly wait: (mode: "all" | "first") => Effect.Effect<ReadonlyArray<ChildResult>, AgentError>
  readonly children: Effect.Effect<ReadonlyArray<ChildSummary>, AgentError>
}

export class AgentRuntime extends Context.Tag("core/AgentRuntime")<AgentRuntime, AgentRuntimeService>() {}

/**
 * The agent registry: names a supervisor can spawn. A program may require
 * the runtime surface plus the coordination services - the runtime provides
 * exactly that set to its children, so orchestration recurses all the way
 * down.
 */
export interface AgentRegistryService {
  readonly get: (name: string) => Option.Option<AgentProgram<any, any, any, AgentRuntime | AgentRegistry | Boards | Groups>>
  readonly names: () => ReadonlyArray<string>
}

export class AgentRegistry extends Context.Tag("core/AgentRegistry")<AgentRegistry, AgentRegistryService>() {}

