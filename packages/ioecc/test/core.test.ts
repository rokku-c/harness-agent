import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  Control,
  EffectAgent,
} from "../src/index.js"

/* ── 一个 Control：声明影响（affects）+ run 逻辑 ── */
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic", ["World"]) }  // 声明影响 World
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    // 经 affects 声明的 connection 实现。
    const world = impls.get("World")
    if (!world) return Effect.fail(new Error("World not provided"))
    return world.handle("run", _i) as Effect.Effect<O, Error>
  }
}

describe("IOECC（影响绑定在 Control 上）", () => {
  test("Control 声明 affects（影响哪些 connection），run 经 impls 访问", async () => {
    const agent = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      connections: ["World"],
      controls: [new RunLogic<string, string>()],
    }, [], new Map<string, ConnectionImpl>([
      ["World", { handle: (op, args) => Effect.succeed(`world:${String(op)}:${String(args)}`) }],
    ]))

    // Control 声明影响 World。
    expect(agent.agent.controls[0]!.affects).toContain("World")

    const out = await Effect.runPromise(agent.drive(0, "hello"))
    expect(out).toBe("world:run:hello")
  })

  test("驱动经 driver 声明的 control", async () => {
    // 一个带 control 的 driver。
    const driver = {
      input: Schema.String,
      output: Schema.String,
      connections: ["World"],
      controls: [new RunLogic<string, string>()],
      drivers: [],
    }
    const agent = EffectAgent.gen({
      input: Schema.String,
      output: Schema.String,
      connections: ["World"],
      controls: [],
    }, [driver], new Map<string, ConnectionImpl>([
      ["World", { handle: (op, args) => Effect.succeed(`driven:${String(args)}`) }],
    ]))

    const out = await Effect.runPromise(agent.drive(0, "hello"))
    expect(out).toBe("driven:hello")
  })

  test("声明一致性：control 的 affects 声明的 connection 必须被 agent 声明", () => {
    expect(() => EffectAgent.gen({
      input: Schema.Void,
      output: Schema.Void,
      connections: [],                        // 没声明 World
      controls: [new RunLogic<void, void>()],  // 但 control 声明影响 World
    })).toThrow(/affects/)
  })
})
