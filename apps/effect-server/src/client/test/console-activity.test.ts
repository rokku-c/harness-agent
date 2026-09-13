import { expect, test } from "bun:test"
import { loadActivity } from "../console-activity.ts"

test("activity aggregates planes, apps, operations and failures without a second status source", async () => {
  const responses: Record<string, unknown> = {
    "/-/status": [{ id: "board", enabled: true, priority: 10 }, { id: "mantis", enabled: false, priority: 20 }],
    "/-/apps": { ui: [{ interfaceId: "board" }], views: ["canvas"], config: [{ appId: "board" }, { appId: "daemon" }] },
    "/-/operations": [{ privileged: true }, { privileged: false }, { privileged: false }],
    "/-/observe/frames": [
      { at: 10, perspective: "agent", target: "board", data: { items: 2 } },
      { at: 20, perspective: "app", target: "mantis", data: { error: "connection refused" } },
    ],
  }
  const snapshot = await loadActivity(async (path) => responses[path])
  expect(snapshot.services).toEqual([{ id: "board", enabled: true, priority: 10 }, { id: "mantis", enabled: false, priority: 20 }])
  expect(snapshot.appCount).toBe(3)
  expect(snapshot.privilegedOperations).toBe(1)
  expect(snapshot.appOperations).toBe(2)
  expect(snapshot.failures).toEqual([{ at: 20, perspective: "app", target: "mantis", error: "connection refused" }])
})

test("activity tolerates absent observation and operation surfaces", async () => {
  const snapshot = await loadActivity(async (path) => {
    if (path === "/-/status") return []
    if (path === "/-/apps") return {}
    throw new Error("HTTP 404")
  })
  expect(snapshot.observations).toEqual([])
  expect(snapshot.failures).toEqual([])
  expect(snapshot.privilegedOperations).toBe(0)
})
