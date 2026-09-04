/**
 * loop/cycle.ts - THE STEP CYCLE (the loop's body).
 *
 * Concept: iterate the canonical step. One step: cooperative yield, drain
 * session signals, checkpoint, project the model-facing surface, inject a
 * reflection when the last step failed a tool, generate, then route the
 * result: tool calls go to turn semantics (turn.ts), a call-less turn goes
 * to termination (decide.ts). Exhausted steps fail. Schema structured
 * results travel as the protocol tool (turn.ts); plain-text JSON is only a
 * single-shot legacy accept handled by decide.ts - no retry nag here.
 */
import { Effect, Option, Queue } from "effect"
import { AgentFailure, AgentPaused, type AgentEvent, type Op, type Until } from "@effect-agent/core"
import type { LoopState, RunBox, EffectAgentOptions } from "./types.ts"
import type { FinalTool } from "./protocol.ts"
import { planSurface, visibleNames, wireTools } from "./protocol.ts"
import { runTurnCalls, type TurnEnv } from "./turn.ts"
import { decide } from "./decide.ts"

export interface CycleEnv {
  readonly driverId: string
  readonly agentName: string
  readonly box: RunBox
  readonly options: EffectAgentOptions
  readonly emit: (event: AgentEvent) => Effect.Effect<void>
  readonly signals: Option.Option<unknown>
  readonly runId: string | undefined
  readonly firstStep: number
  readonly snapshot: (step: number) => Effect.Effect<void>
  readonly allOps: ReadonlyArray<Op<any, any, any, any>>
  readonly byName: Map<string, Op<any, any, any, any>>
  readonly finalTool: FinalTool | undefined
  readonly until: Until<any>
}

export const runCycle = <A>(env: CycleEnv): Effect.Effect<A, AgentFailure, any> =>
  Effect.gen(function* () {
    const maxSteps = env.options.maxSteps ?? 32
    const maxReflections = env.options.maxReflections ?? 1
    const decodeRetries = env.options.decodeRetries ?? 2
    const systemPrompt = env.options.instructions ?? ""
    let reflections = 0
    for (let step = env.firstStep; step < maxSteps; step++) {
      yield* Effect.yieldNow()
      if (Option.isSome(env.signals)) {
        const pending = [...(yield* Queue.takeAll(env.signals.value as any))] as Array<any>
        for (const signal of pending) {
          if (signal._tag === "Interrupt")
            return yield* Effect.fail(new AgentFailure({ agent: env.driverId, cause: "interrupted by signal" }))
          if (signal._tag === "Pause") {
            yield* env.snapshot(step)
            return yield* Effect.fail(new AgentPaused({ runId: env.runId ?? "unknown" }) as unknown as AgentFailure)
          }
          env.box.context = env.box.context.append(...signal.content)
          env.box.thread.push({ role: "user", content: new (env.box.context.constructor as any)(signal.content).render() })
        }
      }
      yield* env.snapshot(step)
      const state: LoopState = { step, usedTools: env.box.usedTools, lastToolError: env.box.lastToolError }
      const surface = planSurface(env.allOps, env.options.planTools, state)
      const tools = wireTools(surface, env.finalTool)
      if (env.box.lastToolError !== undefined && env.options.reflect !== undefined && reflections < maxReflections) {
        const prompt = env.options.reflect(state)
        if (prompt !== undefined) { reflections++; env.box.thread.push({ role: "user", content: prompt }) }
        env.box.lastToolError = undefined
      }
      const result = yield* env.options.model
        .generate(systemPrompt, env.box.thread, tools)
        .pipe(Effect.mapError((cause) => new AgentFailure({ agent: env.driverId, cause })))
      yield* env.emit({ _tag: "Step", agent: env.agentName, step: step + 1 })
      const calls = result.toolCalls ?? []
      if (calls.length > 0 && env.until._tag !== "ToolCall") {
        env.box.thread.push({ role: "assistant", content: result.text, toolCalls: calls })
        const turnEnv: TurnEnv = {
          agentName: env.agentName, driverId: env.driverId, emit: env.emit,
          byName: env.byName, visible: visibleNames(surface), finalTool: env.finalTool, decodeRetries
        }
        const outcome = yield* runTurnCalls<A>(turnEnv, env.box, calls)
        if (outcome._tag === "Return") return outcome.value
        continue
      }
      return yield* decide<A>(env.driverId, env.until, result.text, calls)
    }
    return yield* Effect.fail(new AgentFailure({ agent: env.driverId, cause: "exceeded " + maxSteps + " steps" }))
  })
