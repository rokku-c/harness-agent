/**
 * The app layer's own contract (§6.5-6): what a suspension does to the layer, and
 * what a restore has to put back. The end-to-end behavior is in
 * `kernel-suspend.test.ts`; what is pinned here are the two properties a full run
 * cannot easily show — the order survives, and a restore that did not restore
 * says so instead of reporting a successful swap.
 */

import { expect, test } from "bun:test"
import { makeAppLayer } from "../src/boot/app-layer.ts"
import type { AppSlot } from "../src/manifest-loader/types.ts"

const slot = (appId: string, log: string[]): AppSlot => ({
  appId,
  declaration: { bundleId: `io.effect-agent.${appId}@1.0.0`, abi: "effect-1" },
  dispose: async () => { log.push(`stop:${appId}`) },
})

/**
 * A layer over the named apps. The loader honours `only` — as the real one does —
 * and `overrideWith` replaces what the *next* load hands back, which is how a
 * loader that cannot bring an app back is staged.
 */
const layerOf = (ids: readonly string[], log: string[] = []) => {
  const held = new Map(ids.map((id) => [id, slot(id, log)]))
  let override: AppSlot[] | undefined
  const layer = makeAppLayer({
    load: async (only) => {
      const source = override ?? ids.map((id) => held.get(id)!)
      return only === undefined ? source : source.filter((entry) => only.has(entry.appId))
    },
  })
  return { layer, log, overrideWith: (slots: AppSlot[]) => { override = slots } }
}

const failure = async (run: () => Promise<unknown>): Promise<string> => {
  try { await run() } catch (error) { return error instanceof Error ? error.message : String(error) }
  throw new Error("expected a refusal")
}

test("suspending an app gives up its running place, not its place in the deployment", async () => {
  const log: string[] = []
  const { layer } = layerOf(["a", "b", "c"], log)
  await layer.boot()

  await layer.suspend(["b"])

  expect(log).toEqual(["stop:b"])
  expect(layer.running().length).toBe(2)
  // `b` is still part of what this node is deployed to run — suspended, not
  // forgotten — so the matrix still gets to judge it for the next candidate.
  expect(layer.declared().map((entry) => entry.appId)).toEqual(["a", "b", "c"])
})

test("a name that is not running is ignored rather than reported", async () => {
  const log: string[] = []
  const { layer } = layerOf(["a"], log)
  await layer.boot()

  await layer.suspend(["ghost"])

  expect(log).toEqual([])
  expect(layer.running().length).toBe(1)
})

test("restoring an app puts it back where it was, not at the end", async () => {
  const log: string[] = []
  const { layer } = layerOf(["a", "b", "c"], log)
  await layer.boot()
  await layer.suspend(["b"])
  await layer.restore(["b"])

  // Shutdown tears the layer down in reverse *load* order. An app that drifted to
  // the end on restore would be stopped first, ahead of everything that depends
  // on it — and in a different order every time a swap happened.
  log.length = 0
  for (const stop of layer.running().slice().reverse()) await stop()
  expect(log).toEqual(["stop:c", "stop:b", "stop:a"])
})

test("a restore that does not bring the app back says so", async () => {
  const log: string[] = []
  const { layer, overrideWith } = layerOf(["a"], log)
  await layer.boot()
  await layer.suspend(["a"])
  overrideWith([])          // the app is no longer there to be loaded

  expect(await failure(() => layer.restore(["a"]))).toBe("app layer could not restore a")
})

test("a restore into a place the layer never had says so too", async () => {
  const log: string[] = []
  const { layer, overrideWith } = layerOf(["a"], log)
  await layer.boot()
  overrideWith([slot("ghost", log)])

  expect(await failure(() => layer.restore(["ghost"]))).toBe("app layer could not restore ghost")
})
