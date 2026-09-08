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
  const disposers = await bootManifests({ host, registry }, [MANIFESTS])
  expect(disposers).toHaveLength(2)

  // inproc manifest registered an effect-host plugin + its UI app
  expect(host.isEnabled("demo-inproc")).toBe(true)
  expect((await host.handle(req("/demo"))).status).toBe(200)
  expect(registry.apps().map((a) => a.app.resourceUri)).toContain("ui://demo-inproc/console")

  // stdio manifest registered its tools as an effect-interface
  const tool = registry.tools().find((t) => t.key === "apps/time-server.echo")
  expect(tool).toBeDefined()
  expect(await invoke(tool!.tool, { text: "via yaml" })).toMatchObject({ ok: true, text: "via yaml" })

  for (const dispose of disposers) await dispose()

  expect(host.isEnabled("demo-inproc")).toBe(false)
  expect((await host.handle(req("/demo"))).status).toBe(404)
  expect(registry.schemas()).toHaveLength(0)
  expect(registry.apps()).toHaveLength(0)
})
