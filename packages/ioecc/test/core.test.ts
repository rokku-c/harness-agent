import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  Driver,
  EffectAgent,
  agentDriver,
} from "../src/index.js"

describe("IOECC（元编程 make）", () => {
  test("EffectAgent.make 类型参数声明五维度，compile 注入 driver", async () => {
    const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
    const onInput = { _tag: "OnInput" } as const

    // 元编程形态：泛型参数 I/O/E/Cn/Ct 强制五维度形状。
    const agent = EffectAgent.make<{ city: string }, void, typeof fetchWeather, { name: string }, typeof onInput>({
      input: Schema.Struct({ city: Schema.String }),
      output: Schema.Void,
      effects: [fetchWeather],
      connections: [{ name: "WeatherApp" }],
      controls: [onInput],
    }, (env) => ({
      drive: (index, input) => env.driver.run(input),
      execute: (e) => {
        const impl = env.connections.get(e.connection)
        if (!impl) return Effect.fail(new Error(`Unknown ${e.connection}`))
        return impl.handle(e)
      },
      decode: (v) => Effect.succeed(v),
    }))

    const program = agent.compile({
      driver: { id: "d", run: (i) => Effect.succeed(`driven:${String(i)}`) },
      connections: new Map([["WeatherApp", { handle: () => Effect.succeed("Sunny") }]]),
    })
    const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
    expect(out).toBe("driven:[object Object]")
  })
})

describe("IOECC（Driver 统一执行者）", () => {
  test("compile 注入 driver：driver 驱动 agent", async () => {
    const agent = EffectAgent.gen(function* () {
      yield EffectAgent.input(Schema.Struct({ city: Schema.String }))
      yield EffectAgent.output(Schema.Void)
      yield EffectAgent.effect({ _tag: "FetchWeather", connection: "WeatherApp" })
      yield EffectAgent.connection({ name: "WeatherApp" })
      yield EffectAgent.control({ _tag: "OnInput" })
    })

    // driver：能跑这个 agent 的执行者（input/output 可 unknown）。
    const driver: Driver = {
      id: "fake-driver",
      run: (input) => Effect.succeed(`driven:${String(input)}`),
    }
    const impls = new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ])
    const program = EffectAgent.compile(agent, { driver, connections: impls })

    const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
    expect(out).toBe("driven:[object Object]")
  })

  test("任意 Agent 作 Driver（递归）：组合 agent 包装成 driver", async () => {
    // 一个内层 agent。
    const inner = EffectAgent.gen(function* () {
      yield EffectAgent.input(Schema.String)
      yield EffectAgent.output(Schema.String)
      yield EffectAgent.effect({ _tag: "Echo", connection: "Inner" })
      yield EffectAgent.connection({ name: "Inner" })
      yield EffectAgent.control({ _tag: "OnInput" })
    })
    const innerImpls = new Map<string, ConnectionImpl>([
      ["Inner", { handle: (e) => Effect.succeed(`echo:${String((e as { _tag: string })._tag)}`) }],
    ])
    const innerCompiled = EffectAgent.compile(inner, { driver: { id: "inner", run: (i: unknown) => Effect.succeed(`inner-ran:${String(i)}`) }, connections: innerImpls })

    // 把编译后的内层 agent 包装成 driver，供外层用（递归：agent 当 driver）。
    const innerAsDriver = agentDriver(innerCompiled, { id: "inner-as-driver" })
    expect(innerAsDriver.id).toBe("inner-as-driver")

    // 外层 agent 用 innerAsDriver 当 driver：驱动外层 = 驱动内层（组合链）。
    const outer = EffectAgent.gen(function* () {
      yield EffectAgent.input(Schema.String)
      yield EffectAgent.output(Schema.String)
      yield EffectAgent.control({ _tag: "OnInput" })
    })
    const outerCompiled = EffectAgent.compile(outer, { driver: innerAsDriver, connections: new Map() })

    const out = await Effect.runPromise(outerCompiled.drive(0, "hello"))
    // 外层 driver 是内层 agent：驱动外层 → 内层跑 → 内层结果返回。
    expect(out).toBe("inner-ran:hello")
  })

  test("观测 = driver 提供的额外 Connection", async () => {
    const agent = EffectAgent.gen(function* () {
      yield EffectAgent.input(Schema.Void)
      yield EffectAgent.output(Schema.Void)
      // 观测自己：查 logs（这个 Connection 由 driver 提供，不是 agent 的物理世界）。
      yield EffectAgent.effect({ _tag: "ReadLogs", connection: "SelfLogs" })
      yield EffectAgent.control({ _tag: "OnInput" })
    })

    // driver 额外提供 SelfLogs Connection（观测）。
    const driver: Driver = {
      id: "observable-driver",
      run: (input) => Effect.succeed(input),
      provides: [{ name: "SelfLogs" }],
      observe: new Map<string, ConnectionImpl>([
        ["SelfLogs", { handle: () => Effect.succeed("log-line-1\nlog-line-2") }],
      ]),
    }
    const program = EffectAgent.compile(agent, { driver, connections: new Map() })

    const out = await Effect.runPromise(program.execute({ _tag: "ReadLogs", connection: "SelfLogs" }))
    expect(String(out)).toContain("log-line-1")
  })
})
