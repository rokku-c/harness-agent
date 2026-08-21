import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  Driver,
  EffectAgent,
  agentDriver,
} from "../src/index.js"

/** 一个假 driver：接收输入，直接返回「driven:...」。 */
const fakeDriver: Driver = {
  id: "fake-driver",
  run: (input) => Effect.succeed(`driven:${String(input)}`),
}

describe("IOECC（五维度作入参，gen 就是 compile）", () => {
  test("gen 接收五维度 + driver + connections，直接产出可运行程序", async () => {
    const program = EffectAgent.gen({
      input: Schema.Struct({ city: Schema.String }),
      output: Schema.Void,
      effects: [{ _tag: "FetchWeather", connection: "WeatherApp" }],
      connections: [{ name: "WeatherApp" }],
      controls: [{ _tag: "OnInput" }],
    }, fakeDriver, new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ]))

    const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
    expect(out).toBe("driven:[object Object]")
  })

  test("gen 产出含描述：外部可读 effects/connections/controls", () => {
    const program = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "FetchWeather", connection: "WeatherApp" }],
      connections: [{ name: "WeatherApp" }],
      controls: [{ _tag: "OnInput" }],
    }, fakeDriver)

    expect(program.agent.effects.map((e) => e.connection)).toContain("WeatherApp")
    expect(program.agent.controls.map((c) => c._tag)).toContain("OnInput")
  })

  test("任意 Agent 作 Driver（递归）：组合 agent 包装成 driver", async () => {
    // 内层 agent（gen 产出 Program）。
    const inner = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, { id: "inner", run: (i: unknown) => Effect.succeed(`inner-ran:${String(i)}`) })

    // 把内层 Program 包装成 driver。
    const innerAsDriver = agentDriver(inner, { id: "inner-as-driver" })
    expect(innerAsDriver.id).toBe("inner-as-driver")

    // 外层 agent 用 innerAsDriver 当 driver：驱动外层 → 内层跑。
    const outer = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, innerAsDriver)

    const out = await Effect.runPromise(outer.drive(0, "hello"))
    expect(out).toBe("inner-ran:hello")
  })

  test("观测 = driver 提供的额外 Connection", async () => {
    const observableDriver: Driver = {
      id: "observable-driver",
      run: (input) => Effect.succeed(input),
      observe: new Map<string, ConnectionImpl>([
        ["SelfLogs", { handle: () => Effect.succeed("log-line-1\nlog-line-2") }],
      ]),
    }
    const program = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "ReadLogs", connection: "SelfLogs" }],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, observableDriver)

    const out = await Effect.runPromise(program.execute({ _tag: "ReadLogs", connection: "SelfLogs" }))
    expect(String(out)).toContain("log-line-1")
  })

  test("元编程 make：五维度 + driver → 可运行程序", async () => {
    const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
    const onInput = { _tag: "OnInput" } as const

    const program = EffectAgent.make<{ city: string }, void, typeof fetchWeather, { name: string }, typeof onInput>({
      input: Schema.Struct({ city: Schema.String }),
      output: Schema.Void,
      effects: [fetchWeather],
      connections: [{ name: "WeatherApp" }],
      controls: [onInput],
    }, fakeDriver, new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ]))

    const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
    expect(out).toBe("driven:[object Object]")
  })
})
