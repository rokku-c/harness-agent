import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  Control,
  EffectAgent,
} from "../src/index.js"

/* ── 一个 Control：自带 I/O + affects + run ── */
class RunLogic extends Control<{ task: string }, string> {
  readonly input = Schema.Struct({ task: Schema.String })
  readonly output = Schema.String
  constructor() { super("RunLogic", ["World"]) }  // 影响 World
  run(i: { task: string }, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const world = impls.get("World")
    if (!world) return Effect.fail(new Error("World not provided"))
    return world.handle("run", i.task) as Effect.Effect<string, Error>
  }
}

describe("IOECC（I/O 和 affects 在 Control 上）", () => {
  test("Control 自带 I/O + affects，drive 解码输入并 run", async () => {
    const agent = EffectAgent.gen({
      connections: ["World"],
      controls: [new RunLogic()],
    }, [], new Map<string, ConnectionImpl>([
      ["World", { handle: (op, args) => Effect.succeed(`world:${String(args)}`) }],
    ]))

    const ctrl = agent.agent.controls[0]!
    expect(ctrl.affects).toContain("World")
    expect(ctrl.input).toBeDefined()
    expect(ctrl.output).toBeDefined()

    const out = await Effect.runPromise(agent.drive(0, { task: "hello" }))
    expect(out).toBe("world:hello")
  })

  test("agent 无全局 I/O：是 connections + controls 的组合", () => {
    const agent = EffectAgent.gen({
      connections: ["World"],
      controls: [new RunLogic()],
    })
    expect(agent.agent.connections).toEqual(["World"])
    expect(agent.agent.controls.length).toBe(1)
    expect("input" in agent.agent).toBe(false)  // Agent 无全局 input
  })

  test("驱动经 driver 声明的 control", async () => {
    const driver = {
      connections: ["World"],
      controls: [new RunLogic()],
    }
    const agent = EffectAgent.gen({
      connections: ["World"],
      controls: [],
    }, [driver], new Map<string, ConnectionImpl>([
      ["World", { handle: (op, args) => Effect.succeed(`driven:${String(args)}`) }],
    ]))

    const out = await Effect.runPromise(agent.drive(0, { task: "hello" }))
    expect(out).toBe("driven:hello")
  })

  test("声明一致性：control 的 affects 声明的 connection 必须被 agent 声明", () => {
    expect(() => EffectAgent.gen({
      connections: [],                        // 没声明 World
      controls: [new RunLogic()],             // 但 control 影响 World
    })).toThrow(/affects/)
  })
})
