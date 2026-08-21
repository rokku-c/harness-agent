import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  Agent,
  compile,
  Connection,
  ConnectionImpl,
  Control,
  Effect as EffectDecl,
} from "../src/index.js"

/**
 * 天气记录 Agent —— 验证「抽象概念」模型：
 * Agent 声明五维度（input/output/effects/connections/controls），
 * Effect 只声明哪个 Connection 受影响（无操作契约），compile 时提供契约。
 */

/* ── E：只声明哪个 Connection 受影响 ── */
const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" }
const logInfo = { _tag: "LogInfo", connection: "Logs" }
const writeFile = { _tag: "WriteFile", connection: "Filesystem" }

/* ── C：控制声明（抽象，无契约） ── */
const onInput: Control = { _tag: "OnInput" }

/* ── Agent 描述：五维度声明 ── */
const weatherLogger: Agent<{ city: string }, void> = {
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Void,
  effects: [fetchWeather, logInfo, writeFile],
  connections: [
    { name: "WeatherApp" },
    { name: "Logs" },
    { name: "Filesystem" },
  ],
  controls: [onInput],
}

/* ── compile 时提供契约：Connection 实现如何解释 Effect ── */
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])

describe("IOECC 抽象概念", () => {
  test("Agent 声明五维度，Effect 只声明受影响 Connection（无操作契约）", () => {
    // E 是抽象影响声明，不带 input/output。
    expect(fetchWeather).toEqual({ _tag: "FetchWeather", connection: "WeatherApp" })
    expect("input" in fetchWeather).toBe(false)
    expect("output" in fetchWeather).toBe(false)

    // Agent 五个维度都在。
    expect(weatherLogger.effects.map((e) => e.connection)).toEqual(
      ["WeatherApp", "Logs", "Filesystem"]
    )
    expect(weatherLogger.connections.map((c) => c.name)).toEqual(
      ["WeatherApp", "Logs", "Filesystem"]
    )
    expect(weatherLogger.controls.map((c) => c._tag)).toEqual(["OnInput"])
  })

  test("compile 才执行：按 connection 路由到实现", async () => {
    const program = compile(weatherLogger, { connections: impls })
    const out = await Effect.runPromise(program.execute(fetchWeather))
    expect(String(out)).toBe("Sunny")
  })

  test("外部可访问 effects，知道这个 Agent 影响哪些 Connection", () => {
    // 「后面可以访问」——读 effects 就知道这个 Agent 会碰哪些世界。
    const affected = weatherLogger.effects.map((e) => e.connection)
    expect(affected).toContain("Logs") // 知道对 Logs 有影响
    expect(affected).toContain("Filesystem")
  })
})
