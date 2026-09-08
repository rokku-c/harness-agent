import { afterAll, beforeAll, expect, test } from "bun:test"
import { rmSync } from "node:fs"
import { resolve } from "node:path"

import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { compileEffectBundle, loadEffectBundle } from "../src/index.ts"

const APP = resolve(import.meta.dir, "fixtures/app-one")
const OUT = resolve(import.meta.dir, ".bundle-out")

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true })
})

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true })
})

test("a bundle compiles to a directory artifact and registers itself back into a host", async () => {
  const manifest = await compileEffectBundle({ appDir: APP, outDir: OUT })
  expect(manifest.bundleId).toContain("app-one")

  const registry = makeEffectRegistry()
  const disposer = await loadEffectBundle(resolve(OUT, manifest.bundleId + ".effect-bundle"), {
    registry,
    namespace: "ops",
  })

  const key = registry.tools().map((t) => t.key)
  expect(key).toContain("ops::app-one.echo")

  const tool = registry.tools().find((t) => t.key === "ops::app-one.echo")
  expect(tool).toBeDefined()
  expect(await invoke(tool!.tool, { text: "bundle echo" })).toEqual({ text: "bundle echo" })

  await disposer()
  expect(registry.schemas()).toHaveLength(0)
})

test("the same bundle can load twice under different namespaces without colliding", async () => {
  const manifest = await compileEffectBundle({ appDir: APP, outDir: OUT })
  const dir = resolve(OUT, manifest.bundleId + ".effect-bundle")

  const registry = makeEffectRegistry()
  const closeA = await loadEffectBundle(dir, { registry, namespace: "workspace-a" })
  const closeB = await loadEffectBundle(dir, { registry, namespace: "workspace-b" })

  const keys = registry.tools().map((t) => t.key).sort()
  expect(keys).toEqual(["workspace-a::app-one.echo", "workspace-b::app-one.echo"])

  await closeA()
  expect(registry.tools().map((t) => t.key)).toEqual(["workspace-b::app-one.echo"])
  await closeB()
  expect(registry.tools()).toHaveLength(0)
})
