import { Effect, Schema } from "effect"
import { ConnectionImpl, EffectAgent, control } from "../src/index.js"

/**
 * IOECC 示例 1 —— 最小 Agent（control 工厂形态）。
 *
 * Agent = connections + controls。每个 control 自带 I/O + 影响(affects) + 逻辑。
 * 这里用 `control()` 便捷工厂（函数式形态，适合简单逻辑）。
 *
 * 运行：bun packages/ioecc/examples/01-minimal.ts
 */

const program = EffectAgent.gen({
  connections: ["World"],
  controls: [
    control<{ msg: string }, string>(
      "Echo",
      ["World"],                                              // 影响 World
      (input, impls) => impls.get("World")!.handle("echo", input.msg) as Effect.Effect<string, Error>,
      { input: Schema.Struct({ msg: Schema.String }), output: Schema.String }
    ),
  ],
}, [], new Map<string, ConnectionImpl>([
  ["World", { handle: (op, args) => Effect.succeed(`world:${String(args)}`) }],
]))

const out = await Effect.runPromise(program.drive(0, { msg: "hi" })) as string
console.log("最小 agent →", out)
