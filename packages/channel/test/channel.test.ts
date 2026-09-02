import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Delivery, Ingress, MemoryChannel, MemoryChannelLayer } from "@effect-agent/channel"

describe("MemoryChannel", () => {
  it("read pulls seeded messages in order", async () => {
    const channel = new MemoryChannel({
      seed: [
        { id: "m1", conversationId: "c1", sender: "alice", text: "hi" },
        { id: "m2", conversationId: "c1", sender: "alice", text: "hello?" }
      ]
    })
    expect((await channel.ingress.read())?.text).toBe("hi")
    expect((await channel.ingress.read())?.text).toBe("hello?")
    expect(await channel.ingress.read()).toBeUndefined()
  })

  it("delivery records sent messages with ids", async () => {
    const channel = new MemoryChannel()
    const id = await Effect.runPromise(channel.delivery.send({ conversationId: "c1", text: "answer" }))
    expect(id.length).toBeGreaterThan(0)
    const history = await Effect.runPromise(channel.delivery.history())
    expect(history).toHaveLength(1)
    expect(history[0]!.text).toBe("answer")
    expect(history[0]!.conversationId).toBe("c1")
  })

  it("Layer provides both Ingress and Delivery", async () => {
    const program = Effect.gen(function* () {
      const ingress = yield* Ingress
      const delivery = yield* Delivery
      yield* delivery.send({ conversationId: "c9", text: "ok" })
      return yield* delivery.history()
    }).pipe(
      Effect.provide(MemoryChannelLayer({ seed: [{ id: "x", conversationId: "c9", sender: "bot", text: "go" }] }))
    )
    const history = await Effect.runPromise(program)
    expect(history).toHaveLength(1)
  })
})
