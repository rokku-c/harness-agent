import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  ControlImpl,
  Driver,
  EffectAgent,
  agentDriver,
} from "../src/index.js"

/** 一个假 driver：run + SetProvider。 */
const fakeDriver: Driver = {
  id: "fake-driver",
  run: (input) => Effect.succeed(`driven:${String(input)}`),
  SetProvider: (config) => Effect.succeed(undefined),
}

describe("IOECC（声明 + 控制实现）", () => {
  test("gen 声明五维度 + driver，ControlImpl.run 用 driver 写逻辑", async () => {
    // 1. 声明：五维度 + driver。
    const agent = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, fakeDriver)

    // 2. 控制实现：用 driver 的能力写逻辑（Effect.gen 内 yield* d.xxx()）。
    const program = ControlImpl.run(agent, fakeDriver, (d) => Effect.gen(function* () {
      yield* d.SetProvider!({ baseUrl: "https://api.example.com" }) // 配置 Connection
      return yield* d.run("hello")                                  // 驱动
    }))

    const out = await Effect.runPromise(program)
    expect(out).toBe("driven:hello")
  })

  test("connections 注入 Effect 实现，execute 按 connection 路由", async () => {
    const agent = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "FetchWeather", connection: "WeatherApp" }],
      connections: [{ name: "WeatherApp" }],
      controls: [{ _tag: "OnInput" }],
    }, fakeDriver, new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ]))

    const out = await Effect.runPromise(agent.execute({ _tag: "FetchWeather", connection: "WeatherApp" }))
    expect(String(out)).toBe("Sunny")
  })

  test("任意 Agent 作 Driver（递归）：agentDriver 包装 Program", async () => {
    const inner = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, { id: "inner", run: (i: unknown) => Effect.succeed(`inner-ran:${String(i)}`) })

    const innerAsDriver = agentDriver(inner, { id: "inner-as-driver" })
    expect(innerAsDriver.id).toBe("inner-as-driver")

    // 外层用 innerAsDriver 当 driver。
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
    const agent = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "ReadLogs", connection: "SelfLogs" }],
      connections: [],
      controls: [{ _tag: "OnInput" }],
    }, observableDriver)

    const out = await Effect.runPromise(agent.execute({ _tag: "ReadLogs", connection: "SelfLogs" }))
    expect(String(out)).toContain("log-line-1")
  })
})
