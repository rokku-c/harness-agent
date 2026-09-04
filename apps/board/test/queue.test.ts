import { describe, expect, test } from "bun:test"
import { acknowledge, emptyQueue, enqueue, poll, type BoardCommand } from "../src/launch/queue.ts"

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
})
