/**
 * loop/driver.ts - THE RUN FACADE (top of the layer stack).
 *
 * Concept: turn a RunRequest into a running session. Materialize the
 * request, resolve the runtime services (signals in, events out), derive the
 * granted surface + protocol tool, hydrate the run ledger from its
 * checkpoint when resumed - then hand the ledger to the step cycle. No step
 * logic lives here: that is loop/cycle.ts.
 */
import { Effect, Option, PubSub } from "effect"
import {
  AgentContext, AgentSession, CheckpointStore, materialize, requireUntil,
  type AgentEvent, type Content, type Driver, type RunRequest
} from "@effect-agent/core"
import { recoveryContent } from "../checkpoint.ts"
import type { WireMessage } from "../wire.ts"
import type { EffectAgentOptions, RunBox } from "./types.ts"
import { finalToolFor } from "./protocol.ts"
import { runCycle } from "./cycle.ts"

export const EffectAgent = {
  make: (options: EffectAgentOptions): Driver => {
    const driver: Driver = {
      id: "effect-agent",
      capabilities: {
        provider: { _tag: "Configurable" },
        granularity: "run",
        thinking: false,
        cancel: true,
        pause: true,
        resume: false,
        fork: "none",
        tools: "native",
        toolCalls: "intercept",
        // structured results arrive as the agent-declared protocol tool
        structuredOutput: "tool",
        sandbox: "none"
      },
      run: <A, R>(request: RunRequest<A, R>) =>
        Effect.gen(function* () {
          const unsupported = requireUntil(driver.id, driver.capabilities, request.until)
          if (unsupported) return yield* Effect.fail(unsupported)
          const prepared = yield* materialize(request)
          const session = yield* Effect.serviceOption(AgentSession)
          const agentName = Option.isSome(session) ? session.value.agent : driver.id
          const emit = (event: AgentEvent) =>
            Option.isSome(session) ? Effect.asVoid(PubSub.publish(session.value.events, event)) : Effect.void
          const allOps = prepared.access.flatMap(({ binding, write }) =>
            (binding.ops ?? []).filter((op) => op.access === "read" || write)
          )
          const byName = new Map(allOps.map((op) => [op.name, op]))
          const boundary = request.until._tag === "Schema"
            ? { schema: request.until.schema, asTool: request.until.asTool }
            : undefined
          const finalTool = finalToolFor(boundary, byName)
          const store = Option.isSome(session) ? yield* Effect.serviceOption(CheckpointStore) : Option.none()
          const runId = Option.isSome(session) ? session.value.runId : undefined
          const box: RunBox = { context: prepared.context, thread: [], usedTools: [], retries: 0 }
          box.thread.push({ role: "user", content: prepared.context.render() })
          const resumed = Option.isSome(session) ? session.value.resume : undefined
          let firstStep = 0
          if (resumed !== undefined) {
            const saved = resumed.payload as { context: Content[]; thread: WireMessage[]; step: number }
            box.context = new AgentContext(saved.context)
            box.thread.length = 0
            box.thread.push(...saved.thread)
            box.thread.push({ role: "user", content: new AgentContext(recoveryContent(resumed)).render() })
            firstStep = saved.step
          }
          yield* emit({ _tag: "Step", agent: agentName, step: firstStep })
          const snapshot = (step: number): Effect.Effect<void> =>
            Option.isNone(store) || runId === undefined
              ? Effect.void
              : (store.value.put({
                  ref: { runId }, agent: agentName, task: prepared.context.render(),
                  sensitivities: options.sensitivities ?? [], savedAt: Date.now(),
                  payload: { context: [...box.context.entries], thread: [...box.thread], step }
                }) as unknown as Effect.Effect<void>)
          const result: A = yield* runCycle<A>({
            driverId: driver.id, agentName, box, options, emit, firstStep,
            signals: Option.isSome(session) ? Option.some(session.value.signals) : Option.none(),
            runId, snapshot, allOps, byName, finalTool, until: request.until as any
          })
          return result as unknown as A
        }).pipe(Effect.scoped) as any
    }
    return driver
  }
}
