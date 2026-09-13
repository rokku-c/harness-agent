import { expect, test } from "bun:test"

import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { bootManifests } from "../src/load-manifest.ts"
import { discoverManifests, readServerYaml } from "../src/yaml-manifest.ts"

const MANIFESTS = new URL("./fixtures/manifests", import.meta.url).pathname
const req = (path: string) => new Request("http://127.0.0.1" + path)

test("readServerYaml + discoverManifests read transport declarations from effect.yaml", () => {
  const serverYaml = readServerYaml("server:\n  control: true\nenabled:\n  - a\n  - b\n")
  expect(serverYaml.server?.control).toBe(true)
  expect(serverYaml.enabled).toEqual(["a", "b"])

  const discovered = discoverManifests([MANIFESTS])
  const ids = discovered.map((d) => d.manifest.id).sort()
  expect(ids).toEqual(["apps/time-server", "demo-inproc"])
})

test("bootManifests loads inproc + stdio manifests and disposers clean up", async () => {
  const host = makePluginHost()
  const registry = makeEffectRegistry()
  const slots = await bootManifests({ host, registry }, [MANIFESTS])
  // Each app comes back under the name the app layer acts on (§6.5-6)...
  expect(slots.map((slot) => slot.appId).sort()).toEqual(["apps/time-server", "demo-inproc"])
  // ...and neither fixture ships an `effect.bundle.json`, so neither declares
  // anything: a declaration nobody made is not a declaration.
  expect(slots.every((slot) => slot.declaration === undefined)).toBe(true)

  // inproc manifest registered an effect-host plugin + its UI app
  expect(host.isEnabled("demo-inproc")).toBe(true)
  expect((await host.handle(req("/demo"))).status).toBe(200)
  expect(registry.apps().map((a) => a.app.resourceUri)).toContain("ui://demo-inproc/console")

  // stdio manifest registered its tools as an effect-interface
  const tool = registry.tools().find((t) => t.key === "apps/time-server.echo")
  expect(tool).toBeDefined()
  expect(await invoke(tool!.tool, { text: "via yaml" })).toMatchObject({ ok: true, text: "via yaml" })

  for (const { dispose } of slots) await dispose?.()

  expect(host.isEnabled("demo-inproc")).toBe(false)
  expect((await host.handle(req("/demo"))).status).toBe(404)
  expect(registry.schemas()).toHaveLength(0)
  expect(registry.apps()).toHaveLength(0)
})

test("`only` loads a named app and leaves the rest of the declarations unloaded", async () => {
  const host = makePluginHost()
  const registry = makeEffectRegistry()
  // This is how §6.3-② restores the apps a swap suspended: by name, without
  // re-registering the ones that were never taken down.
  const slots = await bootManifests({ host, registry }, [MANIFESTS], undefined, new Set(["demo-inproc"]))

  expect(slots.map((slot) => slot.appId)).toEqual(["demo-inproc"])
  expect((await host.handle(req("/demo"))).status).toBe(200)
  expect(registry.tools().map((t) => t.key)).not.toContain("apps/time-server.echo")

  for (const { dispose } of slots) await dispose?.()
  expect(host.isEnabled("demo-inproc")).toBe(false)
})

test("a bundle that names a different app than its manifest is refused", async () => {
  const host = makePluginHost()
  const registry = makeEffectRegistry()
  const mismatched = new URL("./fixtures/mismatched", import.meta.url).pathname
  // §6.5-6 suspends an app by the name the app layer knows it by, so a declaration
  // about some *other* app would have a swap take down the wrong one. Refused
  // rather than resolved by picking a winner.
  let thrown = ""
  try { await bootManifests({ host, registry }, [mismatched]) } catch (error) {
    thrown = error instanceof Error ? error.message : String(error)
  }
  expect(thrown).toContain("ships a bundle calling itself other-app, but its manifest calls it bad-app")
})
