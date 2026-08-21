import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  EffectAgent,
  compile,
} from "../src/index.js"

/**
 * IOECC 示例 2 —— 组合：两个 Agent 经共享 Connection 协作（effect-ts style）。
 *
 * Agent 之间不直接调用，共享同一个 Connection（如共享黑板 / 消息总线）。
 * 每个 Agent 用 EffectAgent.gen 声明；compile 时把同一 Connection 实现注入两者，
 * 证明「拓扑由 Connection 长出来，不是核心概念」。
 *
 * 运行：bun packages/ioecc/examples/02-composed.ts
 */

/* ── E ── */
const publish = { _tag: "Publish", connection: "Bus" } as const
const consume = { _tag: "Consume", connection: "Bus" } as const
const announce = { _tag: "Announce", connection: "Logs" } as const

/* ── Agent A：生产者（定时发布到 Bus） ── */
const producer = EffectAgent.gen(function* () {
  yield EffectAgent.input(Schema.Void)
  yield EffectAgent.output(Schema.Void)
  yield EffectAgent.effect(publish)
  yield EffectAgent.connection({ name: "Bus" })
  yield EffectAgent.control({ _tag: "OnCron" })
})

/* ── Agent B：消费者（从 Bus 消费，通告到 Logs） ── */
const consumer = EffectAgent.gen(function* () {
  yield EffectAgent.input(Schema.Unknown)
  yield EffectAgent.output(Schema.Void)
  yield EffectAgent.effect(consume)
  yield EffectAgent.effect(announce)
  yield EffectAgent.connection({ name: "Bus" })
  yield EffectAgent.connection({ name: "Logs" })
  yield EffectAgent.control({ _tag: "OnInput" })
})

/* ── compile：同一个 Bus Connection 注入两个 Agent（拓扑长出来） ── */
const sharedBus: ConnectionImpl = {
  handle: (e) => e._tag === "Publish"
    ? Effect.succeed("published")
    : Effect.succeed("consumed"),
}
const busProgram = compile(producer, { connections: new Map([["Bus", sharedBus]]) })
const consumerProgram = compile(consumer, {
  connections: new Map([["Bus", sharedBus], ["Logs", { handle: () => Effect.succeed(undefined) }]]),
})

console.log("=== 组合拓扑（两 Agent 共享 Bus） ===")
console.log("Producer 影响:", producer.effects.map((e) => e.connection).join(", "))
console.log("Consumer 影响:", consumer.effects.map((e) => e.connection).join(", "))
console.log("共享 Connection:", producer.connections[0]!.name, "=", consumer.connections[0]!.name)

console.log("\n=== 执行 ===")
const out = await Effect.runPromise(busProgram.execute(publish))
const consumed = await Effect.runPromise(consumerProgram.execute(consume))
console.log("Producer 发布 →", out)
console.log("Consumer 消费 →", consumed)
