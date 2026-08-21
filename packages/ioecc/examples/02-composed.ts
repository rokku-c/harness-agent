import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 2 —— 组合：两个 Agent 经共享 Connection 协作。
 *
 * Agent 之间不直接调用，共享同一个 Connection（如共享黑板 / 消息总线）。
 * 每个 Agent 用 EffectAgent.gen（connections + controls）声明；同一个 Connection 实现注入两者，
 * 证明「拓扑由 Connection 长出来，不是核心概念」。
 * I/O + 影响声明绑定在 Control 上：Publish/ConsumeAndAnnounce 自带 I/O，并分别声明影响 Bus/Logs。
 *
 * 运行：bun packages/ioecc/examples/02-composed.ts
 */

/* ── 一个 Control：自带 I/O + 声明影响哪些 connection + run 逻辑 ── */
class Publish extends Control<string, string> {
  readonly input = Schema.String
  readonly output = Schema.String
  constructor() { super("Publish", ["Bus"]) }          // Producer：影响 Bus
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const bus = impls.get("Bus")!
    return bus.handle("publish", i) as Effect.Effect<string, Error>
  }
}

class ConsumeAndAnnounce extends Control<string, string> {
  readonly input = Schema.String
  readonly output = Schema.String
  constructor() { super("ConsumeAndAnnounce", ["Bus", "Logs"]) }  // Consumer：影响 Bus + Logs
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const bus = impls.get("Bus")!
    const logs = impls.get("Logs")!
    return Effect.gen(function* () {
      const msg = yield* bus.handle("consume", i) as Effect.Effect<string, Error>
      yield* logs.handle("info", `consumed ${String(msg)}`)
      return msg
    })
  }
}

/* ── 共享 Bus Connection（拓扑由 Connection 长出） ── */
const sharedBus: ConnectionImpl = {
  handle: (op) => op === "publish" ? Effect.succeed("published") : Effect.succeed("consumed"),
}

/* ── Agent A：生产者（发布到 Bus） ── */
const producer = EffectAgent.gen({
  connections: ["Bus"],
  controls: [new Publish()],
}, [], new Map([["Bus", sharedBus]]))

/* ── Agent B：消费者（从 Bus 消费，通告到 Logs） ── */
const consumer = EffectAgent.gen({
  connections: ["Bus", "Logs"],
  controls: [new ConsumeAndAnnounce()],
}, [], new Map([["Bus", sharedBus], ["Logs", { handle: () => Effect.succeed(undefined as unknown) }]]))

console.log("=== 组合拓扑（两 Agent 共享 Bus） ===")
console.log("Producer 影响:", producer.agent.controls[0]!.affects.join(", "))
console.log("Consumer 影响:", consumer.agent.controls[0]!.affects.join(", "))
console.log("共享 Connection:", producer.agent.connections[0], "=", consumer.agent.connections[0])

console.log("\n=== 执行（各 control 经 impls 访问影响的世界） ===")
const out = await Effect.runPromise(producer.drive(0, "hello")) as string
const consumed = await Effect.runPromise(consumer.drive(0, "hello")) as string
console.log("Producer 发布 →", out)
console.log("Consumer 消费 →", consumed)
