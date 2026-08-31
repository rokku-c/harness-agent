/**
 * The child kernel: fork agent programs as scoped fibers and keep their
 * handles. NOTHING else lives here - no forwarding, no watch rules, no
 * boards. Those are layers above, composed around this kernel.
 */
import { Cause, Effect, Exit, Fiber, Option, PubSub, Queue, Ref, type Scope } from "effect"
import {
  AgentFailure, AgentRegistry, AgentRuntime, AgentSession, Boards, Groups,
  type AgentError, type AgentEvent, type AgentRegistryService, type AgentRuntimeService,
  type ChildResult, type ChildSummary, type Signal, type Spawned
} from "@effect-agent/core"

export interface ChildState {
  readonly childId: string
  readonly agent: string
  readonly fiber: Fiber.RuntimeFiber<unknown, unknown>
  readonly signals: Queue.Queue<Signal>
  readonly bus: PubSub.PubSub<AgentEvent>
}

export const childSummary = (state: ChildState): Effect.Effect<ChildSummary> =>
  Effect.gen(function* () {
    const polled = yield* Fiber.poll(state.fiber)
    if (Option.isNone(polled)) return { childId: state.childId, agent: state.agent, status: "running" as const }
    return exitToResult(state)(polled.value)
  })

export const exitToResult = (state: ChildState) => (exit: Exit.Exit<unknown, unknown>): ChildResult => {
  if (Exit.isSuccess(exit)) return { childId: state.childId, agent: state.agent, status: "completed", output: exit.value }
  const cause = exit.cause
  if (Cause.isInterruptedOnly(cause)) return { childId: state.childId, agent: state.agent, status: "interrupted" }
  if (cause._tag === "Fail" && (cause.error as { _tag?: string })._tag === "AgentFailure" &&
    String((cause.error as { cause?: unknown }).cause ?? "").includes("interrupted"))
    return { childId: state.childId, agent: state.agent, status: "interrupted" }
  return { childId: state.childId, agent: state.agent, status: "failed", error: String(cause) }
}

export interface ChildKernel {
  /** Fork a child; the runtime service handed down is what the child sees. */
  readonly spawn: (agent: string, task: string, runtime: AgentRuntimeService) => Effect.Effect<Spawned, AgentError, Scope.Scope>
  readonly join: (childId: string) => Effect.Effect<ChildResult, AgentError>
  readonly send: (childId: string, signal: Signal) => Effect.Effect<void, AgentError>
  readonly interrupt: (childId: string, hard?: boolean) => Effect.Effect<void, AgentError>
  readonly wait: (mode: "all" | "first") => Effect.Effect<ReadonlyArray<ChildResult>, AgentError>
  readonly children: Effect.Effect<ReadonlyArray<ChildSummary>, AgentError>
  readonly busOf: (childId: string) => Effect.Effect<Option.Option<PubSub.PubSub<AgentEvent>>>
}

/**
 * Build a kernel over a registry. Requires the coordination services only so
 * that children can be handed the same surface their supervisor sees.
 */
export const makeChildKernel = (registry: AgentRegistryService): Effect.Effect<ChildKernel, never, Boards | Groups> =>
  Effect.gen(function* () {
    const boards = yield* Boards
    const groups = yield* Groups
    const children = yield* Ref.make<ReadonlyMap<string, ChildState>>(new Map())

    const kernel: ChildKernel = {
      spawn: (agent, task, runtime) =>
        Effect.gen(function* () {
          const program = registry.get(agent)
          if (Option.isNone(program))
            return yield* new AgentFailure({
              agent: "runtime",
              cause: "unknown agent: " + agent + " (registered: " + registry.names().join(", ") + ")"
            })
          const signals = yield* Queue.unbounded<Signal>()
          const bus = yield* PubSub.unbounded<AgentEvent>()
          const childId = crypto.randomUUID()
          const childEffect = program.value.run(task).pipe(
            Effect.provideService(AgentSession, { agent, signals, events: bus }),
            Effect.provideService(AgentRuntime, runtime),
            Effect.provideService(AgentRegistry, registry),
            Effect.provideService(Boards, boards),
            Effect.provideService(Groups, groups),
            Effect.onExit((exit) =>
              Exit.isSuccess(exit)
                ? PubSub.publish(bus, { _tag: "ChildCompleted", childId, agent, output: exit.value })
                : PubSub.publish(bus, { _tag: "ChildFailed", childId, agent, error: String(exit.cause) })
            ),
            Effect.ensuring(Effect.zipRight(PubSub.shutdown(bus), Queue.shutdown(signals)))
          )
          const fiber = yield* Effect.forkScoped(childEffect)
          yield* Ref.update(children, (map) => new Map(map).set(childId, { childId, agent, fiber, signals, bus }))
          return { childId, agent }
        }),
      join: (childId) =>
        Effect.gen(function* () {
          const state = (yield* Ref.get(children)).get(childId)
          if (state === undefined)
            return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
          return exitToResult(state)(yield* Fiber.await(state.fiber))
        }),
      send: (childId, signal) =>
        Effect.gen(function* () {
          const state = (yield* Ref.get(children)).get(childId)
          if (state === undefined)
            return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
          yield* Queue.offer(state.signals, signal)
        }),
      interrupt: (childId, hard = false) =>
        Effect.gen(function* () {
          const state = (yield* Ref.get(children)).get(childId)
          if (state === undefined)
            return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
          if (hard) yield* Fiber.interrupt(state.fiber)
          else yield* Queue.offer(state.signals, { _tag: "Interrupt" })
        }),
      wait: (mode) =>
        Effect.gen(function* () {
          const states = [...(yield* Ref.get(children)).values()]
          if (states.length === 0) return []
          if (mode === "first") {
            const raced = yield* Effect.raceAll(states.map((state) =>
              Effect.map(Fiber.await(state.fiber), (exit) => ({ state, exit }))
            ))
            return [exitToResult(raced.state)(raced.exit)]
          }
          const results: ChildResult[] = []
          for (const state of states) results.push(exitToResult(state)(yield* Fiber.await(state.fiber)))
          return results
        }),
      children: Effect.gen(function* () {
        const map = yield* Ref.get(children)
        const summaries: ChildSummary[] = []
        for (const state of map.values()) summaries.push(yield* childSummary(state))
        return summaries
      }),
      busOf: (childId) =>
        Effect.map(Ref.get(children), (map) => {
          const state = map.get(childId)
          return state === undefined ? Option.none() : Option.some(state.bus)
        })
    }
    return kernel
  })

