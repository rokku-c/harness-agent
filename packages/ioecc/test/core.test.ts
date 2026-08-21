import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  EffectAgent,
  compile,
} from "../src/index.js"

/**
 * 验证 IOECC 的 effect-ts style：
 * EffectAgent.gen 收集纯描述，compile 才执行。
 */

describe("IOECC（EffectAgent.gen）", () => {
  test("gen 收集五维度纯描述，compile 前不执行", () => {
    const agent = EffectAgent.gen(function* () {
      yield EffectAgent.input(Schema.Struct({ city: Schema.String }))
      yield EffectAgent.output(Schema.Void)
      yield EffectAgent.effect({ _tag: "FetchWeather", connection: "WeatherApp" })
      yield EffectAgent.effect({ _tag: "LogInfo", connection: "Logs" })
      yield EffectAgent.connection({ name: "WeatherApp" })
      yield EffectAgent.connection({ name: "Logs" })
      yield EffectAgent.control({ _tag: "OnInput" })
    })

    // 五维度都在。
    expect(agent.effects.map((e) => e.connection)).toEqual(["WeatherApp", "Logs"])
    expect(agent.connections.map((c) => c.name)).toEqual(["WeatherApp", "Logs"])
    expect(agent.controls.map((c) => c._tag)).toEqual(["OnInput"])
    // 描述可序列化（纯数据）。
    expect(JSON.parse(JSON.stringify(agent)).effects.length).toBe(2)
  })

  test("compile 后按 connection 路由执行", async () => {
    const agent = EffectAgent.gen(function* () {
      yield EffectAgent.output(Schema.Void)
      yield EffectAgent.effect({ _tag: "FetchWeather", connection: "WeatherApp" })
      yield EffectAgent.connection({ name: "WeatherApp" })
    })
    const impls = new Map<string, ConnectionImpl>([
      ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
    ])
    const program = compile(agent, { connections: impls })

    const out = await Effect.runPromise(program.execute({ _tag: "FetchWeather", connection: "WeatherApp" }))
    expect(String(out)).toBe("Sunny")
  })

  test("外部可访问 effects，知道 Agent 影响哪些 Connection", () => {
    const agent = EffectAgent.gen(function* () {
      yield EffectAgent.effect({ _tag: "LogInfo", connection: "Logs" })
      yield EffectAgent.effect({ _tag: "WriteFile", connection: "Filesystem" })
    })
    const affected = agent.effects.map((e) => e.connection)
    expect(affected).toContain("Logs")
    expect(affected).toContain("Filesystem")
  })
})
