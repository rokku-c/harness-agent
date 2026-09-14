import { Context, type Effect, type Option, type Scope } from "effect"
import type { AgentError } from "./errors.ts"
import type { AgentProgram } from "./agent.ts"
import type { Signal } from "./signal.ts"
import type { Boards, Groups } from "./coordination.ts"
import type { ChildResult, ChildSummary, Spawned, Watch } from "./child.ts"

export interface AgentRuntimeService {
  readonly spawn: (agent: string, task: string, watch?: ReadonlyArray<Watch>) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly join: (childId: string) => Effect.Effect<ChildResult, AgentError>
  readonly send: (childId: string, signal: Signal) => Effect.Effect<void, AgentError>
  readonly interrupt: (childId: string, hard?: boolean) => Effect.Effect<void, AgentError>
  readonly pause: (childId: string) => Effect.Effect<void, AgentError>
  readonly resume: (runId: string, task?: string) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly wait: (mode: "all" | "first") => Effect.Effect<ReadonlyArray<ChildResult>, AgentError>
  readonly children: Effect.Effect<ReadonlyArray<ChildSummary>, AgentError>
}

export class AgentRuntime extends Context.Tag("core/AgentRuntime")<AgentRuntime, AgentRuntimeService>() {}

export interface AgentRegistryService {
  readonly get: (name: string) => Option.Option<AgentProgram<any, any, any, AgentRuntime | AgentRegistry | Boards | Groups>>
  readonly names: () => ReadonlyArray<string>
}

export class AgentRegistry extends Context.Tag("core/AgentRegistry")<AgentRegistry, AgentRegistryService>() {}
