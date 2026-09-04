/**
 * children/types.ts - the child kernel's SHAPES and exit semantics.
 *
 * Concept: what a spawned child IS (state: fiber + its signal box + event
 * bus) and how an exit translates into a result (running/completed/
 * interrupted/paused/failed). Pure logic + types: no registry access.
 */
import { Cause, Effect, Exit, Fiber, Option, PubSub, Queue, type Scope } from "effect"
import {
  AgentFailure, AgentPaused,
  type AgentError, type AgentEvent, type AgentRegistryService, type AgentRuntimeService,
  type ChildResult, type ChildSummary, type Signal, type Spawned, type StoredCheckpoint
} from "@effect-agent/core"

export interface ChildState {
  readonly childId: string
  readonly agent: string
  readonly fiber: Fiber.RuntimeFiber<unknown, unknown>
  readonly signals: Queue.Queue<Signal>
  readonly bus: PubSub.PubSub<AgentEvent>
}

export const exitToResult = (state: ChildState) => (exit: Exit.Exit<unknown, unknown>): ChildResult => {
  if (Exit.isSuccess(exit)) return { childId: state.childId, agent: state.agent, status: "completed", output: exit.value }
  const cause = exit.cause
  if (Cause.isInterruptedOnly(cause)) return { childId: state.childId, agent: state.agent, status: "interrupted" }
  if (cause._tag === "Fail" && (cause.error as { _tag?: string })._tag === "AgentPaused")
    return { childId: state.childId, agent: state.agent, status: "paused", checkpointRef: (cause.error as { runId: string }).runId }
  if (cause._tag === "Fail" && (cause.error as { _tag?: string })._tag === "AgentFailure" &&
    String((cause.error as { cause?: unknown }).cause ?? "").includes("interrupted"))
    return { childId: state.childId, agent: state.agent, status: "interrupted" }
  return { childId: state.childId, agent: state.agent, status: "failed", error: String(cause) }
}

export const childSummary = (state: ChildState): Effect.Effect<ChildSummary> =>
  Effect.gen(function* () {
    const polled = yield* Fiber.poll(state.fiber)
    if (Option.isNone(polled)) return { childId: state.childId, agent: state.agent, status: "running" as const }
    return exitToResult(state)(polled.value)
  })

export interface ChildKernel {
  /** Fork a child; the runtime service handed down is what the child sees. A seed resumes from an archive. */
  readonly spawn: (agent: string, task: string, runtime: AgentRuntimeService, seed?: { readonly resume?: StoredCheckpoint }) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly join: (childId: string) => Effect.Effect<ChildResult, AgentError>
  readonly send: (childId: string, signal: Signal) => Effect.Effect<void, AgentError>
  readonly interrupt: (childId: string, hard?: boolean) => Effect.Effect<void, AgentError>
  readonly wait: (mode: "all" | "first") => Effect.Effect<ReadonlyArray<ChildResult>, AgentError>
  readonly children: Effect.Effect<ReadonlyArray<ChildSummary>, AgentError>
  readonly busOf: (childId: string) => Effect.Effect<Option.Option<PubSub.PubSub<AgentEvent>>>
}
