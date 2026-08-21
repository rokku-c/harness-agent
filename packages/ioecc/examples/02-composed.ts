import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 2 —— 组合：两个 Agent 经共享 Connection 协作。
 *
 * Agent 之间不直接调用，共享同一个 Connection（如共享黑板 / 消息总线）。
 * 每个 Agent 用 EffectAgent.gen（五维度）声明；同一个 Connection 实现注入两者，
 * 证明「拓扑由 Connection 长出来，不是核心概念」。
 * 影响声明绑定在 Control 上（affects）：Producer/Consumer 分别声明影响 Bus/Logs。
 *
 * 运行：bun packages/ioecc/examples/02-composed.ts
 */

/* ── 一个 Control：声明影响哪些 connection + run 逻辑 ── */
class Publish<I, O> extends Control<I, O> {
  constructor() { super("Publish", ["Bus"]) }          // Producer：影响 Bus
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const bus = impls.get("Bus")!
    return bus.handle("publish", _i) as Effect.Effect<O, Error>
  }
}

class ConsumeAndAnnounce<I, O> extends Control<I, O> {
  constructor() { super("ConsumeAndAnnounce", ["Bus", "Logs"]) }  // Consumer：影响 Bus + Logs
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const bus = impls.get("Bus")!
    const logs = impls.get("Logs")!
    return Effect.gen(function* () {
      const msg = yield* bus.handle("consume", _i)
      yield* logs.handle("info", `consumed ${String(msg)}`)
      return msg as O
    })
  }
}

/* ── 共享 Bus Connection（拓扑由 Connection 长出） ── */
const sharedBus: ConnectionImpl = {
  handle: (op) => op === "publish" ? Effect.succeed("published") : Effect.succeed("consumed"),
}

/* ── Agent A：生产者（发布到 Bus） ── */
const producer = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  connections: ["Bus"],
  controls: [new Publish<string, string>()],
}, [], new Map([["Bus", sharedBus]]))

/* ── Agent B：消费者（从 Bus 消费，通告到 Logs） ── */
const consumer = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  connections: ["Bus", "Logs"],
  controls: [new ConsumeAndAnnounce<string, string>()],
}, [], new Map([["Bus", sharedBus], ["Logs", { handle: () => Effect.succeed(undefined) }]]))

console.log("=== 组合拓扑（两 Agent 共享 Bus） ===")
console.log("Producer 影响:", producer.agent.controls[0]!.affects.join(", "))
console.log("Consumer 影响:", consumer.agent.controls[0]!.affects.join(", "))
console.log("共享 Connection:", producer.agent.connections[0], "=", consumer.agent.connections[0])

console.log("\n=== 执行（各 control 经 impls 访问影响的世界） ===")
const out = await Effect.runPromise(producer.drive(0, "hello")) as string
const consumed = await Effect.runPromise(consumer.drive(0, "hello")) as string
console.log("Producer 发布 →", out)
console.log("Consumer 消费 →", consumed)
