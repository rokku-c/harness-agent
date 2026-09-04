import { describe, expect, test } from "bun:test"
import { acknowledge, deserialize, emptyQueue, enqueue, makeCommandQueue, poll, serialize, type BoardCommand } from "../src/launch/queue.ts"
import { makeProbeGateway } from "../src/launch.ts"

const command = (id: string, agentId = "probe"): BoardCommand => ({ id, agentId, kind: "launch", runId: id, createdAt: 1 })

describe("probe command queue", () => {
  test("poll is non-destructive until acknowledgement", () => {
    const queue = enqueue(emptyQueue(), command("c1"))
    expect(poll(queue, "probe")).toHaveLength(1)
    expect(poll(queue, "probe")).toHaveLength(1)
    expect(poll(acknowledge(queue, ["c1"]), "probe")).toHaveLength(0)
  })
  test("duplicate command ids are idempotent", () => {
    const queue = enqueue(enqueue(emptyQueue(), command("c1")), command("c1"))
    expect(queue.commands).toHaveLength(1)
  })
  test("runtime facade composes enqueue, poll and ack", () => {
    const queue = makeCommandQueue()
    queue.enqueue(command("c2"))
    expect(queue.poll("probe")).toHaveLength(1)
    queue.acknowledge(["c2"])
    expect(queue.snapshot().commands).toHaveLength(0)
  })
  test("snapshots preserve pending commands", () => {
    const queue = enqueue(emptyQueue(), command("c3"))
    expect(deserialize(serialize(queue)).commands[0]?.runId).toBe("c3")
  })
  test("gateway polls only its agent and records heartbeat", () => {
    const gateway = makeProbeGateway()
    gateway.submit(command("c4", "probe-a"))
    expect(gateway.poll("probe-b").commands).toHaveLength(0)
    expect(gateway.poll("probe-a").commands).toHaveLength(1)
    expect(gateway.lastSeen("probe-a")).toBeDefined()
    gateway.ack(["c4"])
    expect(gateway.poll("probe-a").commands).toHaveLength(0)
  })
})
