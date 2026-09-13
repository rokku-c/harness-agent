/**
 * §6.5-6's third disposition, proven end to end (docs/architecture-rework.md §6.3):
 * an effect-line move suspends the apps the incoming kernel would break, and
 * **only** those. An app that made no declaration has nothing to do with the
 * change of line, keeps serving across the whole swap, and is never stopped or
 * reloaded.
 *
 * The failure this file is about is a swap whose blast radius is wider than its
 * damage: one bundled app that cannot follow the new line taking every other app
 * on the node down with it. Today the spared apps are exactly the ones that
 * shipped no `effect.bundle.json` — a declaration nobody made is not a
 * declaration — so that set is large, and it used to pay for every swap.
 */

import { expect, test } from "bun:test"
import { KERNEL_ABI } from "@effect-agent/effect-bundle"
import { clearFixtureLog, fixtureKernelSource, fixtureLog, incompleteKernelSource } from "./kernel-fixture.ts"
import { boot, req, revisionFor, withWorkspace } from "./swap-fixture.ts"

/** One root: a bundled app on the shipped line, and one that declares nothing. */
const deployBoth = (w: { appRoot: (app: { id: string; abi?: string; route?: string }) => string }): string[] => {
  const roots = [w.appRoot({ id: "board-app", abi: KERNEL_ABI, route: "/demo" })]
  w.appRoot({ id: "plain-app", route: "/plain" })
  return roots
}

const logOf = (app: string): string[] => fixtureLog().filter((entry) => entry.includes(app))

test("a swap suspends only the apps the new kernel would break", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile, roots: deployBoth(w) }, ["config", "board-app", "plain-app"])
    try {
      expect(await (await app.host.handle(req("/plain"))).text()).toBe("plain-app")

      const result = await app.stageKernel(
        revisionFor("io.effect-agent.kernel@2.0.0", 2, w.artifact("k2", fixtureKernelSource("k2")), "effect-2"),
      )

      expect(result.ok).toBe(true)
      expect(app.kernelRevision()?.revision).toBe(2)
      expect(await (await app.host.handle(req("/-/config"))).json()).toMatchObject({ marker: "k2" })
      // The bundled app could not follow the line: it was suspended and put back.
      expect(logOf("board-app")).toEqual(["load:board-app", "stop:board-app", "load:board-app"])
      // The app that declared nothing was never touched — one load, at boot, and
      // no stop. It went on answering across a swap it had nothing to do with.
      expect(logOf("plain-app")).toEqual(["load:plain-app"])
      expect(await (await app.host.handle(req("/plain"))).text()).toBe("plain-app")
    } finally { await app.stop() }
  })
})

test("a failed swap hands back exactly the app it suspended, and no other", async () => {
  clearFixtureLog()
  await withWorkspace(async (w) => {
    const app = await boot({ configFile: w.configFile, roots: deployBoth(w) }, ["config", "board-app", "plain-app"])
    try {
      // The right effect line, so ② is the path taken, but the artifact leaves a
      // host slot unfilled — refused *after* the app layer has been touched.
      const staged = await app.stageKernel(
        revisionFor("io.effect-agent.kernel@2.0.0", 2, w.artifact("k-partial", incompleteKernelSource), "effect-2"),
      )

      expect(staged).toMatchObject({ ok: false, reason: "failed" })
      // The suspension was undone and the app serves again — a failed ② is not
      // allowed to leave its apps down...
      expect(logOf("board-app")).toEqual(["load:board-app", "stop:board-app", "load:board-app"])
      expect(await (await app.host.handle(req("/demo"))).text()).toBe("board-app")
      // ...while the app nobody suspended was not reloaded by somebody else's
      // rollback either.
      expect(logOf("plain-app")).toEqual(["load:plain-app"])
      expect(app.kernelRevision()?.revision).toBe(1)
    } finally { await app.stop() }
  })
})
