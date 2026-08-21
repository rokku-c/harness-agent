import { Effect, Schema } from "effect"
import { ConnectionImpl, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 2 —— 组合：两个 Agent 经共享 Connection 协作。
 *
 * Agent 之间不直接调用，共享同一个 Connection（如共享黑板 / 消息总线）。
 * 每个 Agent 用 EffectAgent.gen（五维度作入参）声明；同一个 Connection 实现注入两者，
 * 证明「拓扑由 Connection 长出来，不是核心概念」。
 *
 * 运行：bun packages/ioecc/examples/02-composed.ts
 */

/* ── E ── */
const publish = { _tag: "Publish", connection: "Bus" } as const
const consume = { _tag: "Consume", connection: "Bus" } as const
const announce = { _tag: "Announce", connection: "Logs" } as const

/* ── Driver ── */
const driver: Driver = { id: "fake-driver", run: (input) => Effect.succeed(input) }

/* ── 共享 Bus Connection（拓扑长出来） ── */
const sharedBus: ConnectionImpl = {
  handle: (e) => e._tag === "Publish"
    ? Effect.succeed("published")
    : Effect.succeed("consumed"),
}

/* ── Agent A：生产者（定时发布到 Bus） ── */
const producer = EffectAgent.gen({
  input: Schema.Void,
  output: Schema.Void,
  effects: [publish],
  connections: [{ name: "Bus" }],
  controls: [{ _tag: "OnCron" }],
}, driver, new Map([["Bus", sharedBus]]))

/* ── Agent B：消费者（从 Bus 消费，通告到 Logs） ── */
const consumer = EffectAgent.gen({
  input: Schema.Unknown,
  output: Schema.Void,
  effects: [consume, announce],
  connections: [{ name: "Bus" }, { name: "Logs" }],
  controls: [{ _tag: "OnInput" }],
}, driver, new Map([["Bus", sharedBus], ["Logs", { handle: () => Effect.succeed(undefined) }]]))

console.log("=== 组合拓扑（两 Agent 共享 Bus） ===")
console.log("Producer 影响:", producer.agent.effects.map((e) => e.connection).join(", "))
console.log("Consumer 影响:", consumer.agent.effects.map((e) => e.connection).join(", "))
console.log("共享 Connection:", producer.agent.connections[0]!.name, "=", consumer.agent.connections[0]!.name)

console.log("\n=== 执行 ===")
const out = await Effect.runPromise(producer.execute(publish))
const consumed = await Effect.runPromise(consumer.execute(consume))
console.log("Producer 发布 →", out)
console.log("Consumer 消费 →", consumed)
