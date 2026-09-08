/**
 * effect-observe: sqlite store semantics, observer change detection, replay.
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createObservationStore,
  startObserver,
  type ObservationSnapshot,
  type Perspective,
  type Sampler,
} from "../src/index.ts"

const snap = (
  perspective: Perspective, target: string, at: number, data: unknown,
): ObservationSnapshot => ({ at, perspective, target, data })

describe("effect-observe", () => {
  test("store records frames; latest() returns the newest per perspective+target", () => {
    const store = createObservationStore(":memory:")
    store.record(snap("agent", "order-svc", 1, { ui: "a" }))
    store.record(snap("agent", "order-svc", 3, { ui: "b" }))
    store.record(snap("app", "order-svc", 2, { live: 0 }))
    expect(store.count()).toBe(3)
    expect(store.latest("agent", "order-svc")?.data).toEqual({ ui: "b" })
    expect(store.latest("global", "order-svc")).toBeUndefined()
  })

  test("observer records a baseline, then a frame only when sampled state changes", async () => {
    const store = createObservationStore(":memory:")
    let state = { ui: "idle" }
    const sampler: Sampler = () => state
    const observer = startObserver({
      store, sampler, target: "order-svc", perspectives: ["agent"], intervalMs: 0,
    })
    try {
      const first = await observer.tick()
      expect(first?.data).toEqual({ ui: "idle" })
      expect(store.count()).toBe(1)
      expect(await observer.tick()).toBeNull() // unchanged -> no new frame
      expect(store.count()).toBe(1)
      state = { ui: "submitting", form: { qty: 2 } }
      const changed = await observer.tick()
      expect(changed?.data).toEqual({ ui: "submitting", form: { qty: 2 } })
      expect(store.count()).toBe(2)
      expect(store.latest("agent", "order-svc")?.data).toEqual({ ui: "submitting", form: { qty: 2 } })
    } finally {
      observer.stop()
    }
  })

  test("frames() filters by perspective and target", () => {
    const store = createObservationStore() // default: ":memory:"
    store.record(snap("app", "a", 1, 1))
    store.record(snap("agent", "a", 2, 2))
    store.record(snap("global", "a", 3, 3))
    store.record(snap("agent", "b", 4, 4))
    expect(store.frames({ perspective: "agent" }).map((f) => f.data)).toEqual([2, 4])
    expect(store.frames({ perspective: "agent", target: "b" }).map((f) => f.data)).toEqual([4])
  })

  test("frames() replay is ascending recorded order; honors since/until", () => {
    const store = createObservationStore(":memory:")
    store.record(snap("agent", "x", 10, "one"))
    store.record(snap("app", "y", 20, "two"))
    store.record(snap("agent", "x", 30, "three"))
    expect(store.frames({ target: "x" }).map((f) => f.data)).toEqual(["one", "three"])
    expect(store.frames({ since: 15, until: 35 }).map((f) => f.data)).toEqual(["two", "three"])
  })

  test("sqlite store persists frames to a file across reopen", () => {
    const file = join(mkdtempSync(join(tmpdir(), "effect-observe-")), "frames.sqlite")
    createObservationStore(file).record(snap("global", "mesh", 5, { nodes: 2 }))
    createObservationStore(file).record(snap("global", "mesh", 9, { nodes: 3 }))
    const reopened = createObservationStore(file)
    expect(reopened.count()).toBe(2)
    expect(reopened.frames({ target: "mesh" }).map((f) => f.data)).toEqual([{ nodes: 2 }, { nodes: 3 }])
    expect(reopened.latest("global", "mesh")?.data).toEqual({ nodes: 3 })
  })
})
