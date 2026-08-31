import { Context, type Effect, type Option, type Scope } from "effect"
import type { AgentError } from "./errors.ts"
import type { AgentProgram } from "./agent.ts"

/**
 * The supervision surface: spawn children, talk to them while they run,
 * wait for them, and declare watch rules - when a child reports at a
 * declared moment, the runtime forks a responder. Coordination structures
 * (boards, groups) are URI-addressable bindings, so an agent hands them to
 * children as ordinary capability access.
 */
export type Trigger = { readonly kind: "progress" | "completed" }

export interface Watch {
  readonly when: Trigger
  readonly spawn: { readonly agent: string; readonly task: string }
}

export interface Spawned {
  readonly childId: string
  readonly agent: string
}

export type ChildStatus = "running" | "completed" | "failed" | "interrupted"

export interface ChildResult {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
  readonly output?: unknown
  readonly error?: string
}

export interface ChildSummary {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
}

export interface AgentRuntimeService {
  readonly spawn: (agent: string, task: string, watch?: ReadonlyArray<Watch>) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly join: (childId: string) => Effect.Effect<ChildResult, AgentError>
  readonly send: (childId: string, signal: import("./signal.ts").Signal) => Effect.Effect<void, AgentError>
  readonly interrupt: (childId: string, hard?: boolean) => Effect.Effect<void, AgentError>
  readonly wait: (mode: "all" | "first") => Effect.Effect<ReadonlyArray<ChildResult>, AgentError>
  readonly children: Effect.Effect<ReadonlyArray<ChildSummary>, AgentError>
  /** Report the CURRENT agent's own progress to its supervisor. */
  readonly emitProgress: (agent: string, text: string) => Effect.Effect<void, AgentError>
  readonly createBoard: (name: string) => Effect.Effect<string, AgentError>
  readonly postBoard: (uri: string, author: string, text: string) => Effect.Effect<void, AgentError>
  readonly readBoard: (uri: string) => Effect.Effect<ReadonlyArray<BoardEntry>, AgentError>
  readonly createGroup: (name: string, children: ReadonlyArray<string>) => Effect.Effect<string, AgentError>
  readonly postGroup: (uri: string, author: string, text: string) => Effect.Effect<void, AgentError>
  readonly readGroup: (uri: string, limit?: number) => Effect.Effect<ReadonlyArray<GroupEntry>, AgentError>
}

export interface BoardEntry {
  readonly seq: number
  readonly author: string
  readonly text: string
}

export interface GroupEntry {
  readonly author: string
  readonly text: string
}

export class AgentRuntime extends Context.Tag("core/AgentRuntime")<AgentRuntime, AgentRuntimeService>() {}

/**
 * The agent registry: names a supervisor can spawn. A program may require
 * the runtime itself - the runtime provides its children the same surface,
 * so orchestration recurses all the way down.
 */
export interface AgentRegistryService {
  readonly get: (name: string) => Option.Option<AgentProgram<any, any, any, AgentRuntime | AgentRegistry>>
  readonly names: () => ReadonlyArray<string>
}

export class AgentRegistry extends Context.Tag("core/AgentRegistry")<AgentRegistry, AgentRegistryService>() {}

