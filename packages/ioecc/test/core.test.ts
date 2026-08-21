import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  Connection,
  ConnectionImpl,
  Control,
  Driver,
  Effect as EffectDecl,
  EffectAgent,
} from "../src/index.js"

/* ── 一个 Control 实现：用 driver 能力写逻辑 ── */
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i: I, _o: O, _e: ReadonlyArray<EffectDecl<any>>, _cn: ReadonlyArray<Connection>, _ct: ReadonlyArray<Control>, d: Driver): Effect.Effect<O, Error> {
    // d 是具体 driver（Agent），其能力由具体实现提供。这里 cast 到有 run 的假 driver。
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)
  }
}

/* ── 一个假 driver：是 Agent（五维度），声明自己的 control（能力） + 具体方法 run ── */
const fakeDriver = {
  input: Schema.String,
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [new RunLogic<string, string>()],
  drivers: [],
  // 具体 driver 的实现能力（Agent 之外的具体方法）。
  run: (input: string) => Effect.succeed(`driven:${String(input)}`),
}

describe("IOECC（driver 声明 control）", () => {
  test("driver 是 Agent（五维度 + 自己声明的 control），gen 注入 n 个 driver", async () => {
    // driver 声明 control（RunLogic）；gen 注入 drivers。
    const agent = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [],
    }, [fakeDriver])

    // 驱动：执行 driver 声明的 control（RunLogic → d.run）。
    const out = await Effect.runPromise(agent.drive(0, "hello"))
    expect(out).toBe("driven:hello")
  })

  test("connections 注入 Effect 实现，execute 按 connection 路由", async () => {
    const agent = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "FetchWeather", connection: "WeatherApp" }],
      connections: [{ name: "WeatherApp" }],
      controls: [],
    }, [fakeDriver], new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ]))

    const out = await Effect.runPromise(agent.execute({ _tag: "FetchWeather", connection: "WeatherApp" }))
    expect(String(out)).toBe("Sunny")
  })

  test("多个 driver：drivers 数组", async () => {
    const driverA = { ...fakeDriver, run: (i: string) => Effect.succeed(`A:${i}`) }
    const driverB = { ...fakeDriver, run: (i: string) => Effect.succeed(`B:${i}`) }

    const agent = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      effects: [],
      connections: [],
      controls: [],
    }, [driverA, driverB])

    expect(agent.agent.drivers.length).toBe(2)
  })

  test("观测 = 具体 driver 作为 Connection", async () => {
    // 观测 Connection 声明 + 由外围注入实现。
    const agent = EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      effects: [{ _tag: "ReadLogs", connection: "SelfLogs" }],
      connections: [{ name: "SelfLogs" }],
      controls: [],
    }, [fakeDriver], new Map<string, ConnectionImpl>([
      ["SelfLogs", { handle: () => Effect.succeed("log-line-1\nlog-line-2") }],
    ]))

    const out = await Effect.runPromise(agent.execute({ _tag: "ReadLogs", connection: "SelfLogs" }))
    expect(String(out)).toContain("log-line-1")
  })

  test("声明一致性：effect 指向未声明的 connection 时报错", () => {
    expect(() => EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      // effects 声明了 "WeatherApp"，但 connections 没声明它 → 应报错。
      effects: [{ _tag: "FetchWeather", connection: "WeatherApp" }],
      connections: [],
      controls: [],
    }, [fakeDriver])).toThrow(/not in connections/)
  })
})
