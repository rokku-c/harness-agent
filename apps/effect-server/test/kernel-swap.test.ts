/**
 * P5's second segment, proven end to end (docs/architecture-rework.md §6.2, §6.3-①,
 * §6.5-4/5): a kernel revision is loaded from an artifact directory, flipped in
 * behind a stable dispatch point, and the displaced kernel stops only once its
 * in-flight requests are done — while every app keeps serving untouched.
 */

import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { BOOTSTRAP_ABI, KERNEL_ABI, kernelRevision } from "@effect-agent/effect-bundle"
import { KERNEL } from "../src/boot/kernel.ts"
import {
  clearFixtureLog, fixtureKernelSource, fixtureLog, incompleteKernelSource, openFixtureGate, resetFixtureGate,
} from "./kernel-fixture.ts"
import { boot, req, revisionFor, until, withWorkspace } from "./swap-fixture.ts"

test("boot records the shipped revision so the next start has a rollback target", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ stateFile: w.stateFile, configFile: w.configFile })
    try {
      expect(app.kernelRevision()).toEqual({ ...kernelRevision(KERNEL, 1), revision: 1 })
      expect(app.kernelBoot()?.fellBack).toBeUndefined()
      // the shipped kernel is behind the same stand-ins every revision will use
      const body = await (await app.host.handle(req("/-/config"))).json()
      expect(Array.isArray(body)).toBe(true)
      expect(JSON.parse(readFileSync(w.stateFile, "utf8")).active.kernelId).toBe(KERNEL.kernelId)
    } finally { await app.stop() }
  })
})

test("an effect-line move rebuilds the app layer instead of refusing (§6.3-②)", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    // A deployed app that declared effect-1, and a root to discover it from.
    const roots = [w.appRoot({ id: "demo-app", abi: KERNEL_ABI })]
    const app = await boot({ configFile: w.configFile, roots }, ["config", "demo-app"])
    try {
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("demo-app")

      // The new kernel speaks effect-2: the host can run it, but no app that
      // declared effect-1 can talk to it. Before ② this was a refusal.
      const result = await app.stageKernel(
        revisionFor("io.effect-agent.kernel@2.0.0", 2, w.artifact("k2", fixtureKernelSource("k2")), "effect-2"),
      )

      expect(result.ok).toBe(true)
      expect(app.kernelRevision()?.revision).toBe(2)
      expect(await (await app.host.handle(req("/-/config"))).json()).toMatchObject({ marker: "k2" })
      // The app layer came back: the same route answers, from a re-registered app.
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("demo-app")
      // ...and this is what made it a rebuild rather than a swap — the app was
      // stopped before the new kernel was even loaded, which is ②'s longer window.
      expect(fixtureLog()).toEqual(["load:demo-app", "stop:demo-app", "load:k2", "load:demo-app"])
    } finally { await app.stop() }
  })
})

test("a rebuild that fails hands the apps back and leaves the old kernel serving", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const roots = [w.appRoot({ id: "demo-app", abi: KERNEL_ABI })]
    const app = await boot({ configFile: w.configFile, roots }, ["config", "demo-app"])
    try {
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("demo-app")

      // Right effect line (so ② is the path taken), but the artifact leaves the
      // platform-network slot unfilled — the host's coverage probe refuses it
      // *after* the app layer has already been taken down.
      const staged = await app.stageKernel(kernelRevision(
        { kernelId: "io.effect-agent.kernel@3.0.0", abi: "effect-2", bootstrapAbi: BOOTSTRAP_ABI, runtimes: ["os"] },
        2,
        w.artifact("k-partial-2", incompleteKernelSource),
      ))

      expect(staged).toMatchObject({ ok: false, reason: "failed" })
      if (!staged.ok && staged.reason === "failed") {
        expect((staged.error as Error).message).toContain("leaves slot platform-network unfilled")
      }
      // The apps were unloaded and replayed, and they serve again: a failed ② is
      // not allowed to leave the node with an empty app layer.
      expect(fixtureLog()).toEqual(["load:demo-app", "stop:demo-app", "load:demo-app"])
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("demo-app")
      expect(app.kernelRevision()?.revision).toBe(1)   // the candidate never became the kernel
    } finally { await app.stop() }
  })
})

test("a staged artifact kernel takes over, and the app-visible surface keeps its identity", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile })
    let loads = 0
    try {
      // An app registered on the host is what a kernel swap must not disturb.
      await app.host.register({
        id: "demo-app", priority: 100,
        load: async () => { loads++; return { canHandle: (p) => p === "/demo", handle: async () => new Response("demo") } },
      })
      await app.host.handle(req("/demo"))

      const result = await app.stageKernel(revisionFor("io.effect-agent.kernel@9.9.9", 2, w.artifact("k2", fixtureKernelSource("k2"))))

      expect(result.ok).toBe(true)
      expect(app.kernelRevision()?.revision).toBe(2)
      // the new kernel answers, and it is the artifact's
      const body = await (await app.host.handle(req("/-/config"))).json()
      expect(body).toMatchObject({ kernel: "io.effect-agent.kernel@9.9.9", marker: "k2" })
      // and the app was never re-registered: same loaded plane, one load() ever
      expect(loads).toBe(1)
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("demo")
      // the host's routing table did not move: same ids, same priorities
      expect(app.host.list().map((p) => p.id)).toEqual(["platform-network", "config", "demo-app"])
    } finally { await app.stop() }
  })
})

test("the displaced kernel stops only after its in-flight requests finish", async () => {
  clearFixtureLog()
  resetFixtureGate()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile })
    try {
      await app.stageKernel(revisionFor("io.effect-agent.kernel@1.0.0", 2, w.artifact("k-hold", fixtureKernelSource("hold", true))))

      // a request that enters kernel "hold" and stays inside it
      const held = app.host.handle(req("/-/config"))
      await until(() => fixtureLog().includes("load:hold"))

      let settled = false
      const staged = app.stageKernel(revisionFor("io.effect-agent.kernel@2.0.0", 3, w.artifact("k-next", fixtureKernelSource("next"))))
        .then((result) => { settled = true; return result })
      await until(() => fixtureLog().includes("load:next"))

      // Committed: new requests are already answered by the successor...
      expect(await (await app.host.handle(req("/-/config"))).json()).toMatchObject({ marker: "next" })
      // ...while the displaced kernel is still alive, because it still owes a reply
      expect(fixtureLog()).toEqual(["load:hold", "load:next"])
      expect(settled).toBe(false)

      openFixtureGate()
      expect(await (await held).json()).toMatchObject({ marker: "hold" })   // answered by the old kernel
      expect((await staged).ok).toBe(true)                                  // the swap completes
      expect(fixtureLog()).toEqual(["load:hold", "load:next", "dispose:hold"])
    } finally { await app.stop() }
  })
})

test("an incompatible artifact is refused and the active kernel keeps serving", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile })
    try {
      const good = await app.stageKernel(revisionFor("io.effect-agent.kernel@1.0.0", 2, w.artifact("k-ok", fixtureKernelSource("ok"))))
      expect(good.ok).toBe(true)

      const refusal = await app.stageKernel(kernelRevision(
        { kernelId: "io.effect-agent.kernel@2.0.0", abi: KERNEL_ABI, bootstrapAbi: "bootstrap-2" }, 3,
      ))

      expect(refusal).toMatchObject({ ok: false, reason: "incompatible" })
      expect(app.kernelRevision()?.revision).toBe(2)
      expect(fixtureLog()).toEqual(["load:ok"])           // nothing was even loaded
      expect(await (await app.host.handle(req("/-/config"))).json()).toMatchObject({ marker: "ok" })
    } finally { await app.stop() }
  })
})

test("an artifact that leaves a host slot unfilled is refused before the flip", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile })
    try {
      const result = await app.stageKernel(revisionFor("io.effect-agent.kernel@3.0.0", 2, w.artifact("k-partial", incompleteKernelSource)))

      expect(result).toMatchObject({ ok: false, reason: "failed" })
      if (!result.ok && result.reason === "failed") {
        expect((result.error as Error).message).toContain("leaves slot platform-network unfilled")
      }
      expect(app.kernelRevision()?.revision).toBe(1)      // the shipped kernel never moved
    } finally { await app.stop() }
  })
})

test("a kernel that will not load leaves the active one serving, and boot falls back next time", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    // A recorded active revision this host cannot run, with a usable previous one.
    writeFileSync(w.stateFile, JSON.stringify({
      active: { ...kernelRevision({ kernelId: "broken", abi: KERNEL_ABI, bootstrapAbi: "bootstrap-9" }, 7) },
      previous: kernelRevision(KERNEL, 1),
    }))

    const app = await boot({ stateFile: w.stateFile, configFile: w.configFile })
    try {
      expect(app.kernelBoot()?.fellBack?.from.kernelId).toBe("broken")
      expect(app.kernelBoot()?.fellBack?.reason).toContain("bootstrap-9")
      expect(app.kernelRevision()?.kernelId).toBe(KERNEL.kernelId)

      // the broken revision is condemned, so the next start goes straight to the
      // good one instead of re-running the failure every boot
      const state = JSON.parse(readFileSync(w.stateFile, "utf8"))
      expect(state.condemned).toEqual([7])
      expect(state.active.kernelId).toBe(KERNEL.kernelId)
    } finally { await app.stop() }
  })
})
