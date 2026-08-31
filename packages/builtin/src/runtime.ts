/**
 * The default composition: registry + child kernel + boards + groups +
 * checkpoint store + session wiring (forward, watch), assembled into one
 * runtime layer. Every piece lives in its own module - this file only wires
 * them. Pause is the kernel's send with a Pause signal; resume looks up the
 * archive and spawns the same agent hydrated from it.
 */
import { Effect, Layer, Option } from "effect"
import { AgentFailure, AgentRegistry, AgentRuntime, Boards, CheckpointStore, Groups, type AgentProgram, type AgentRuntimeService } from "@effect-agent/core"
import { CheckpointStoreLayer } from "./checkpoint.ts"
import { BoardsLayer } from "./boards.ts"
import { GroupsLayer } from "./groups.ts"
import { makeChildKernel } from "./children.ts"
import { forwardChildEvents, startWatchers } from "./signals.ts"

export type RuntimeAgents = Readonly<Record<string, AgentProgram<any, any, any, AgentRuntime | AgentRegistry | Boards | Groups>>>

export const FiberAgentRuntime = {
  /** Layer the runtime over an agent registry. */
  layer: (agents: RuntimeAgents) =>
    Effect.gen(function* () {
      const registry = {
        get: (name: string) => Option.fromNullable(agents[name]),
        names: () => Object.keys(agents)
      }
      const kernel = yield* makeChildKernel(registry)
      const store = yield* CheckpointStore
      const service: AgentRuntimeService = {
        spawn: (agent, task, watch = []) =>
          Effect.gen(function* () {
            const spawned = yield* kernel.spawn(agent, task, service)
            const bus = yield* kernel.busOf(spawned.childId)
            if (Option.isSome(bus)) {
              yield* forwardChildEvents({ agent, bus: bus.value })
              yield* startWatchers((next, nextTask) => service.spawn(next, nextTask), bus.value, spawned.childId, agent, watch)
            }
            return spawned
          }),
        pause: (childId) => kernel.send(childId, { _tag: "Pause" }),
        resume: (runId, task) =>
          Effect.gen(function* () {
            const stored = yield* store.get({ runId })
            if (stored === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown checkpoint: " + runId + " (known: " + (yield* Effect.map(store.list(), (all) => all.map((c) => c.ref.runId).join(", "))) + ")" })
            return yield* kernel.spawn(stored.agent, task ?? stored.task, service, { resume: stored })
          }),
        join: kernel.join,
        send: kernel.send,
        interrupt: kernel.interrupt,
        wait: kernel.wait,
        children: kernel.children
      }
      return service
    }).pipe(
      (effect) => Layer.effect(AgentRuntime, effect),
      Layer.provideMerge(BoardsLayer),
      Layer.provideMerge(GroupsLayer),
      Layer.provideMerge(CheckpointStoreLayer)
    ),
  /** The registry layer for named agents. */
  registry: (agents: RuntimeAgents) =>
    Layer.succeed(AgentRegistry, {
      get: (name: string) => Option.fromNullable(agents[name]),
      names: () => Object.keys(agents)
    })
}

