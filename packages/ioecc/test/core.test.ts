import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
  Agent,
  ControlExecutor,
  ControlIntent,
  EffectExecutor,
  EffectIntent,
} from "../src/index.js"

/* ── 静态 Trigger（ControlIntent 实例，自带触发后的行为） ── */

class OnInput<I, O> implements ControlIntent<I, O> {
  readonly _kind = "Control" as const
  readonly _tag = "OnInput" as const
  constructor(
    readonly payload: I,
    readonly resultSchema: Schema.Schema<O>,
    /** 触发后的行为：输入 → 结果（逻辑属于被触发的那次运行）。 */
    readonly handle: (input: I) => Effect.Effect<O, Error>
  ) {}
}

/* ── 动态 Control（ControlIntent 实例，运行期声明） ── */

class Fork implements ControlIntent<{ agentId: string }, string> {
  readonly _kind = "Control" as const
  readonly _tag = "Fork" as const
  constructor(
    readonly payload: { agentId: string },
    readonly resultSchema: Schema.Schema<string> = Schema.String
  ) {}
}

/* ── 具体的 E（EffectIntent 实例） ── */

class FetchWeather implements EffectIntent<{ city: string }, string> {
  readonly _kind = "Effect" as const
  readonly _tag = "FetchWeather" as const
  constructor(
    readonly payload: { city: string },
    readonly resultSchema: Schema.Schema<string> = Schema.String
  ) {}
}

/* ── Connection 实现：解释 FetchWeather ── */

const weatherConnection = Layer.effect(EffectExecutor, Effect.succeed({
  execute: <Payload, Result>(intent: EffectIntent<Payload, Result>) => {
    if (intent._tag === "FetchWeather") {
      const w = intent as unknown as FetchWeather
      return Effect.succeed(`Sunny in ${w.payload.city}`) as unknown as Effect.Effect<Result, Error>
    }
    return Effect.fail(new Error(`Unknown effect ${intent._tag}`))
  },
}))

/* ── ControlExecutor：解释静态 Trigger（跑 handle）与动态 Control（Fork） ── */

const controlImpl = (agent: Agent) => Layer.effect(ControlExecutor, Effect.succeed({
  control: <Payload, Result>(intent: ControlIntent<Payload, Result>) => {
    // 静态 Trigger（OnInput）：跑它的 handle。
    if (intent._tag === "OnInput") {
      const t = intent as unknown as OnInput<unknown, unknown>
      return t.handle(t.payload) as unknown as Effect.Effect<Result, Error>
    }
    // 动态 Control（Fork）：这里返回「已 fork」。
    if (intent._tag === "Fork") {
      const f = intent as unknown as Fork
      return Effect.succeed(`forked:${f.payload.agentId}`) as unknown as Effect.Effect<Result, Error>
    }
    return Effect.fail(new Error(`Unknown control ${intent._tag}`))
  },
}))

describe("IOECC 核心（纯概念）", () => {
  test("静态 Trigger 携带行为：OnInput 触发 handle", async () => {
    const agent: Agent = {
      controls: [new OnInput({ city: "Shanghai" }, Schema.String, () => Effect.succeed("Sunny"))],
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ctl = yield* ControlExecutor
        const trigger = agent.controls[0]!
        return yield* ctl.control(trigger)
      }).pipe(Effect.provide(controlImpl(agent)))
    )
    expect(result).toBe("Sunny")
  })

  test("动态 Control 运行期声明：Fork", async () => {
    const agent: Agent = {
      controls: [new OnInput({}, Schema.String, () => Effect.succeed("ok"))],
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ctl = yield* ControlExecutor
        // 运行期动态声明 Fork（不是 Agent 声明期的 controls）。
        return yield* ctl.control(new Fork({ agentId: "child-1" }))
      }).pipe(Effect.provide(controlImpl(agent)))
    )
    expect(result).toBe("forked:child-1")
  })

  test("EffectExecutor 路由 EffectIntent 到 Connection", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const exec = yield* EffectExecutor
        return yield* exec.execute(new FetchWeather({ city: "Tokyo" }))
      }).pipe(Effect.provide(weatherConnection))
    )
    expect(result).toBe("Sunny in Tokyo")
  })

  test("Agent 只有 controls，没有 logic/trigger 特殊字段", () => {
    const agent: Agent = {
      controls: [new OnInput({}, Schema.String, () => Effect.succeed("x"))],
    }
    expect(Array.isArray(agent.controls)).toBe(true)
    expect("logic" in agent).toBe(false)
    // 触发器的「行为」在触发器自己身上（handle），不在 Agent 上。
  })
})
