import { expect, test } from "bun:test"
import {
  BOOTSTRAP_ABI,
  makeKernelSupervisor,
  makeMemoryKernelRepo,
  kernelRevision,
  type KernelRevision,
  type KernelState,
  type DeclaredApp,
} from "../src/index.ts"

/** A kernel instance the tests can observe: who stopped, who is in front. */
interface TestKernel {
  readonly id: string
}

const rev = (id: string, n: number, over: Partial<KernelRevision> = {}): KernelRevision => ({
  ...kernelRevision({ kernelId: id, abi: "effect-1", bootstrapAbi: BOOTSTRAP_ABI, runtimes: ["os"] }, n),
  ...over,
})

/**
 * A supervisor over `TestKernel`, with a log of what happened. `broken` names the
 * revisions whose load() throws, `unhealthy` those whose probe() throws.
 *
 * `rebuild` injects §6.3-②'s app layer. It is deliberately optional: with it
 * absent the supervisor must behave exactly as it did before ② existed, and one
 * of the tests below is there to keep that true.
 */
const harness = (options: {
  repo?: KernelState
  broken?: readonly string[]
  unhealthy?: readonly string[]
  activateThrows?: boolean
  /** Throw only when *this* kernel id reaches the dispatcher, so boot still works. */
  activateThrowsFor?: string
  apps?: () => readonly DeclaredApp[]
  rebuild?: {
    teardownThrows?: boolean
    /** Fail this many `replay()` calls. Two = the retry fails too, so nothing came back. */
    replayFails?: number
  }
} = {}) => {
  const repo = makeMemoryKernelRepo(options.repo ?? {})
  const loaded: string[] = []
  const stopped: string[] = []
  const activations: string[] = []
  const events: string[] = []
  /** Only the app layer's own moves, in order, naming the apps each one was for. */
  const appLog: string[] = []
  /** What had already been stopped when the app layer went down (must be nothing). */
  let stoppedAtTeardown: string[] | undefined
  let replayFailures = options.rebuild?.replayFails ?? 0
  let front: TestKernel | undefined

  const supervisor = makeKernelSupervisor<TestKernel>({
    repo,
    apps: options.apps,
    rebuild: options.rebuild === undefined ? undefined : {
      teardown: async (apps) => {
        appLog.push(`teardown:${apps.join(",")}`)
        stoppedAtTeardown = stopped.slice()
        if (options.rebuild?.teardownThrows === true) throw new Error("app layer will not unload")
      },
      replay: async (apps) => {
        appLog.push(`replay:${apps.join(",")}`)
        if (replayFailures > 0) { replayFailures--; throw new Error("app layer will not come back") }
      },
    },
    load: async (entry) => {
      loaded.push(entry.kernelId)
      if (options.broken?.includes(entry.kernelId) === true) throw new Error(`${entry.kernelId} will not load`)
      return { id: entry.kernelId }
    },
    dispose: (kernel) => { stopped.push(kernel.id) },
    probe: (slot) => {
      if (options.unhealthy?.includes(slot.revision.kernelId) === true) throw new Error(`${slot.revision.kernelId} unhealthy`)
    },
    activate: (kernel) => {
      if (options.activateThrows === true || options.activateThrowsFor === kernel.id) throw new Error("dispatcher refused")
      front = kernel
      activations.push(kernel.id)
    },
    onEvent: (event) => { events.push(event.kind) },
  })

  return {
    supervisor, repo, loaded, stopped, activations, events, appLog,
    front: () => front,
    stoppedAtTeardown: () => stoppedAtTeardown,
  }
}

test("a compatible swap flips, records active/previous, and only then stops the old kernel", async () => {
  const h = harness()
  const a = rev("kernel-a", 1)
  const b = rev("kernel-b", 2)

  await h.supervisor.boot(a)
  expect(h.front()?.id).toBe("kernel-a")

  // record when kernel-a stops relative to the flip
  const order: string[] = []
  const watched = makeKernelSupervisor<TestKernel>({
    repo: h.repo,
    load: async (r) => ({ id: r.kernelId }),
    dispose: (kernel) => { order.push(`stop:${kernel.id}`) },
    activate: (kernel) => { order.push(`activate:${kernel.id}`) },
  })
  await watched.boot(a)
  order.length = 0

  const staged = await watched.stage(b)
  expect(staged.ok).toBe(true)
  // the invariant: the new kernel is in front BEFORE the old one stops
  expect(order).toEqual(["activate:kernel-b", "stop:kernel-a"])
  expect(watched.state()).toEqual({ active: b, previous: a })
  expect(watched.active()?.kernel.id).toBe("kernel-b")
  expect(watched.previous()?.kernel.id).toBe("kernel-a")
})

test("a rejected candidate is discarded and the active kernel is untouched", async () => {
  const h = harness()
  const a = rev("kernel-a", 1)
  // a kernel needing a bootstrap line this host does not implement
  const bad = rev("kernel-c", 2, { bootstrapAbi: "bootstrap-2" })
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(bad)

  expect(staged.ok).toBe(false)
  if (!staged.ok) expect(staged.reason).toBe("incompatible")
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual([])      // nothing was stopped
  expect(h.loaded).not.toContain("kernel-c") // never even loaded
  expect(h.supervisor.state()).toEqual({ active: a })
})

test("a candidate that would break a loaded app is refused by the matrix, not loaded", async () => {
  const h = harness({ apps: () => [{ appId: "board", declaration: { bundleId: "io.effect-agent.board@1.0.0", abi: "effect-1" } }] })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const breaking = rev("kernel-d", 2, { abi: "effect-2" })
  const staged = await h.supervisor.stage(breaking)

  expect(staged.ok).toBe(false)
  if (!staged.ok) {
    expect(staged.reason).toBe("apps-incompatible")
    if (staged.refusal.kind === "apps") {
      // named the way the app layer names it, so §6.5-6 could suspend it
      expect(staged.refusal.broken[0].app).toBe("board")
    }
  }
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual([])
})

/**
 * §6.3-② (docs/architecture-rework.md): the same candidate as the test above —
 * one that would break a loaded app — but the host has offered an app layer it
 * can take down and put back, so instead of refusing, the kernel is *rebuilt in*.
 *
 * Two apps on purpose: what the supervisor hands the app layer is the list the
 * matrix produced, and one name could not tell that apart from a supervisor that
 * named only the first.
 */
const loadedApps = () => [
  { appId: "board", declaration: { bundleId: "io.effect-agent.board@1.0.0", abi: "effect-1" } },
  { appId: "mantis", declaration: { bundleId: "io.effect-agent.mantis@1.0.0", abi: "effect-1" } },
]

test("an effect-line move is rebuilt in: apps down, B flipped in, apps back, and only then A stops", async () => {
  const h = harness({ apps: loadedApps, rebuild: {} })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  // kernel-b speaks effect-2; both loaded apps declared effect-1.
  const rebuilt = await h.supervisor.stage(rev("kernel-b", 2, { abi: "effect-2" }))

  expect(rebuilt.ok).toBe(true)
  expect(h.front()?.id).toBe("kernel-b")
  expect(h.appLog).toEqual(["teardown:board,mantis", "replay:board,mantis"])
  // ②'s window is admitted, not hidden: the apps were down before the flip, so
  // what this asserts is the weaker (and true) claim — A was still *loaded*.
  expect(h.stoppedAtTeardown()).toEqual([])
  expect(h.stopped).toEqual(["kernel-a"])
  expect(h.supervisor.state()).toEqual({ active: rev("kernel-b", 2, { abi: "effect-2" }), previous: a })
  expect(h.events).toContain("rebuilding")
  expect(h.events).toContain("rebuilt")
  expect(h.events).not.toContain("rejected")
})

test("a compatible swap never touches the app layer, even when one is offered", async () => {
  const h = harness({ apps: loadedApps, rebuild: {} })
  await h.supervisor.boot(rev("kernel-a", 1))

  const staged = await h.supervisor.stage(rev("kernel-b", 2))   // same effect-1 line

  expect(staged.ok).toBe(true)
  expect(h.appLog).toEqual([])          // ① is still a pure swap
  expect(h.loaded).toEqual(["kernel-a", "kernel-b"])
  expect(h.stopped).toEqual(["kernel-a"])
})

test("the bootstrap line is refused even when the app layer could have been rebuilt", async () => {
  const h = harness({ apps: loadedApps, rebuild: {} })
  await h.supervisor.boot(rev("kernel-a", 1))

  // Wrong host↔kernel line: no amount of re-registering apps makes this runnable.
  const staged = await h.supervisor.stage(rev("kernel-b", 2, { bootstrapAbi: "bootstrap-2" }))

  expect(staged.ok).toBe(false)
  if (!staged.ok) expect(staged.reason).toBe("incompatible")
  expect(h.appLog).toEqual([])          // the apps were never taken down
  expect(h.loaded).toEqual(["kernel-a"])
  expect(h.front()?.id).toBe("kernel-a")
})

test("a rebuilt candidate that will not load leaves A serving and the apps back up", async () => {
  const h = harness({ apps: loadedApps, rebuild: {}, broken: ["kernel-b"] })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2, { abi: "effect-2" }))

  expect(staged.ok).toBe(false)
  if (!staged.ok) expect(staged.reason).toBe("failed")
  expect(h.appLog).toEqual(["teardown:board,mantis", "replay:board,mantis"])   // taken down, then handed back
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual([])
  expect(h.supervisor.state()).toEqual({ active: a })
})

test("a rebuilt candidate whose flip fails goes back to A, and the apps come back with it", async () => {
  const h = harness({ apps: loadedApps, rebuild: {}, activateThrowsFor: "kernel-b" })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2, { abi: "effect-2" }))

  expect(staged.ok).toBe(false)
  if (!staged.ok) expect(staged.reason).toBe("failed")
  expect(h.appLog).toEqual(["teardown:board,mantis", "replay:board,mantis"])
  expect(h.activations).toEqual(["kernel-a", "kernel-a"])   // flipped back to A
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual(["kernel-b"])                   // the candidate was dropped
  expect(h.supervisor.state()).toEqual({ active: a })
})

test("a rebuild that cannot restore the apps says so instead of reporting a clean rollback", async () => {
  // Two replay failures: the one after the flip, and the retry in the recovery
  // path. Nothing put the app layer back, and the result has to say that out loud.
  const h = harness({ apps: loadedApps, rebuild: { replayFails: 2 } })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2, { abi: "effect-2" }))

  expect(staged.ok).toBe(false)
  if (!staged.ok) {
    expect(staged.reason).toBe("failed")
    expect((staged.error as Error).message).toContain("needs a restart")
  }
  const failure = h.events.filter((kind) => kind === "rebuild-failed")
  expect(failure).toHaveLength(1)
  // A is still in front and the candidate is gone: the node is degraded, not stuck mid-swap.
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual(["kernel-b"])
})

test("a rebuild that cannot unload the apps at all hands them straight back", async () => {
  const h = harness({ apps: loadedApps, rebuild: { teardownThrows: true } })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2, { abi: "effect-2" }))

  expect(staged.ok).toBe(false)
  expect(h.appLog).toEqual(["teardown:board,mantis", "replay:board,mantis"])
  expect(h.loaded).toEqual(["kernel-a"])     // B was never loaded
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.supervisor.state()).toEqual({ active: a })
})

test("a candidate that fails to load leaves the active kernel serving", async () => {
  const h = harness({ broken: ["kernel-b"] })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2))

  expect(staged.ok).toBe(false)
  if (!staged.ok) expect(staged.reason).toBe("failed")
  expect(h.front()?.id).toBe("kernel-a")
  expect(h.stopped).toEqual([])
  expect(h.supervisor.state().active?.kernelId).toBe("kernel-a")
})

test("a candidate that fails its health probe is dropped, active untouched", async () => {
  const h = harness({ unhealthy: ["kernel-b"] })
  const a = rev("kernel-a", 1)
  await h.supervisor.boot(a)

  const staged = await h.supervisor.stage(rev("kernel-b", 2))

  expect(staged.ok).toBe(false)
  expect(h.front()?.id).toBe("kernel-a")
  // the unhealthy candidate is stopped (it was loaded), the active one is not
  expect(h.stopped).toEqual(["kernel-b"])
})

test("a failed flip puts the old kernel back in front instead of leaving nothing", async () => {
  const h = harness({ activateThrows: true })
  const a = rev("kernel-a", 1)

  await expect(h.supervisor.boot(a)).rejects.toThrow("dispatcher refused")

  // boot with a working dispatcher, then break the flip for the swap
  const h2 = harness()
  await h2.supervisor.boot(a)
  const brokenFlip = makeKernelSupervisor<TestKernel>({
    repo: h2.repo,
    load: async (r) => ({ id: r.kernelId }),
    activate: (kernel) => { if (kernel.id === "kernel-b") throw new Error("flip failed"); h2.activations.push(kernel.id) },
  })
  await brokenFlip.boot(a)
  const staged = await brokenFlip.stage(rev("kernel-b", 2))

  expect(staged.ok).toBe(false)
  expect(brokenFlip.active()?.kernel.id).toBe("kernel-a")
  // A went back in front because it was never stopped
  expect(h2.stopped).toEqual([])
})

test("boot falls back to the previous revision when the active one will not load", async () => {
  const a = rev("kernel-a", 1)
  const b = rev("kernel-b", 2)
  const h = harness({ repo: { active: b, previous: a }, broken: ["kernel-b"] })

  const result = await h.supervisor.boot()

  expect(result.ok).toBe(true)
  expect(result.fellBack?.from.kernelId).toBe("kernel-b")
  expect(result.fellBack?.reason).toContain("will not load")
  expect(h.front()?.id).toBe("kernel-a")
  // the broken revision is recorded as condemned, so the next boot does not retry it
  expect(h.supervisor.state()).toEqual({ active: a, previous: undefined, condemned: [2] })
  expect(h.events).toContain("fell-back")
})

test("a condemned revision is not retried on the next boot", async () => {
  const a = rev("kernel-a", 1)
  const b = rev("kernel-b", 2)
  const h = harness({ repo: { active: b, previous: a, condemned: [2] } })

  const result = await h.supervisor.boot()

  expect(result.fellBack).toBeUndefined()   // straight to a, no failure to report
  expect(h.loaded).toEqual(["kernel-a"])
  expect(h.front()?.id).toBe("kernel-a")
})

test("boot refuses when nothing can run, naming every reason", async () => {
  const h = harness({ repo: { active: rev("kernel-z", 3, { bootstrapAbi: "bootstrap-9" }) } })

  let thrown: unknown
  try {
    await h.supervisor.boot()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(Error)
  const message = (thrown as Error).message
  expect(message).toContain("no kernel revision could boot")
  expect(message).toContain("bootstrap-9")
  expect(h.front()).toBeUndefined()
})

test("an empty repo boots the shipped revision and records it", async () => {
  const h = harness()
  const shipped = rev("kernel-shipped", 1)

  const result = await h.supervisor.boot(shipped)

  expect(result.fellBack).toBeUndefined()
  expect(h.front()?.id).toBe("kernel-shipped")
  expect(h.supervisor.state()).toEqual({ active: shipped })
  expect(h.events).toEqual(["booted"])
})

test("with nothing recorded and nothing shipped, boot says so instead of guessing", async () => {
  const h = harness()
  await expect(h.supervisor.boot()).rejects.toThrow(/no kernel revision to boot/)
})

test("a swap preserves the condemned list, so a fallback is not undone by the next push", async () => {
  const a = rev("kernel-a", 1)
  const b = rev("kernel-b", 2)
  const h = harness({ repo: { active: b, previous: a, condemned: [9] }, broken: ["kernel-b"] })

  await h.supervisor.boot()                       // falls back to a, condemning b
  await h.supervisor.stage(rev("kernel-c", 3))    // and a later push must keep both records

  expect(h.supervisor.state().condemned).toEqual([9, 2])
  expect(h.supervisor.state().active?.kernelId).toBe("kernel-c")
  expect(h.supervisor.state().previous?.kernelId).toBe("kernel-a")
})
