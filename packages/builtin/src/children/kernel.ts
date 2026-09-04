/**
 * children/kernel.ts - the child KERNEL: one registry-backed map of spawned
 * children (fiber + signal box + bus) and the supervisor's verbs over it.
 * Exit semantics live in types.ts - nothing else here.
 */
import { Effect, Exit, Fiber, Option, PubSub, Queue, Ref } from "effect"
import {
  AgentFailure, AgentRuntime, AgentRegistry, AgentSession, Boards, CheckpointStore, Groups,
  type AgentEvent, type AgentRegistryService, type ChildResult, type Signal, type Spawned, type StoredCheckpoint
} from "@effect-agent/core"
import { childSummary, exitToResult, type ChildKernel, type ChildState } from "./types.ts"

/**
 * Build a kernel over a registry. Requires the coordination services only so
 * that children can be handed the same surface their supervisor sees.
 */
export const makeChildKernel = (registry: AgentRegistryService): Effect.Effect<ChildKernel, never, Boards | Groups | CheckpointStore> =>
  Effect.gen(function* () {
    const boards = yield* Boards
    const groups = yield* Groups
    const store = yield* CheckpointStore
    const children = yield* Ref.make<ReadonlyMap<string, ChildState>>(new Map())

    const byId = (childId: string) =>
      Effect.gen(function* () {
        const state = (yield* Ref.get(children)).get(childId)
        if (state === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
        return state
      })

    const kernel: ChildKernel = {
      spawn: (agent, task, runtime, seed) =>
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
            Effect.provideService(AgentSession, { agent, signals, events: bus, runId: crypto.randomUUID(), resume: seed?.resume }),
            Effect.provideService(AgentRuntime, runtime),
            Effect.provideService(AgentRegistry, registry),
            Effect.provideService(Boards, boards),
            Effect.provideService(Groups, groups),
            Effect.provideService(CheckpointStore, store),
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
          return exitToResult(yield* byId(childId))(yield* Fiber.await((yield* byId(childId)).fiber))
        }),
      send: (childId, signal) =>
        Effect.gen(function* () {
          yield* Queue.offer((yield* byId(childId)).signals, signal)
        }),
      interrupt: (childId, hard = false) =>
        Effect.gen(function* () {
          const state = yield* byId(childId)
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
        return yield* Effect.forEach([...(yield* Ref.get(children)).values()], childSummary)
      }),
      busOf: (childId) =>
        Effect.map(Ref.get(children), (map) => (map.get(childId) === undefined ? Option.none() : Option.some(map.get(childId)!.bus)))
    }
    return kernel
  })
