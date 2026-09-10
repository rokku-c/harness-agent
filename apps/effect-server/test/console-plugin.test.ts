import { expect, test } from "bun:test"

import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { memoryConfigs as makeConfigRegistry } from "./config-helpers.ts"
import type { EffectUiView } from "@effect-agent/effect-ui"
import { makeConsolePlugin } from "../src/console-plugin.ts"

const req = (path: string, init?: RequestInit) => new Request("http://127.0.0.1" + path, init)
const j = async <T>(r: Response): Promise<T> => (await r.json()) as T

test("console catalogs registered apps and config apps", async () => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "apps/demo",
    tools: [],
    apps: [{ id: "console", title: "Demo console", resourceUri: "ui://apps/demo/console", path: "/demo" }],
  })
  const configs = makeConfigRegistry()
  configs.register({ appId: "board", title: "Board", schema: z.object({ webPort: z.number().default(3999) }) })

  const host = makePluginHost()
  await host.register(makeConsolePlugin({ registry, configs, yamlOf: () => ({ webPort: 4100 }) }))

  expect((await host.handle(req("/console"))).status).toBe(200)

  const cat = await j<{ ui: Array<{ resourceUri: string; path?: string }>; config: Array<{ appId: string }>; systemUi: { elements: Record<string, { type: string }> } }>(await host.handle(req("/-/apps")))
  expect(cat.ui[0].resourceUri).toBe("ui://apps/demo/console")
  expect(cat.ui[0].path).toBe("/demo")
  expect(cat.config.map((c) => c.appId)).toContain("board")
  expect(cat.systemUi.elements["0"].type).toBe("Dock")
  expect(cat.systemUi.elements["1"].type).toBe("Springboard")
})

test("console serves a view DESCRIPTION (with json-render spec) for client rendering", async () => {
  const view: EffectUiView = { viewId: "demo-view", title: "Demo view", nodes: [{ kind: "text", text: "hello view" }] }
  const host = makePluginHost()
  await host.register(
    makeConsolePlugin({ registry: makeEffectRegistry(), configs: makeConfigRegistry(), uiViews: new Map([["demo-view", view]]) }),
  )

  const res = await host.handle(req("/console/api/view/demo-view"))
  const data = await j<{ kind: string; view: { nodes: Array<{ text?: string }> }; jsonSpec: { root: string } }>(res)
  expect(data.kind).toBe("view")
  expect(data.view.nodes[0].text).toBe("hello view")
  expect(data.jsonSpec.root).toBe("root")
})

test("console config API imports YAML once and Save updates the authoritative value", async () => {
  const configs = makeConfigRegistry()
  configs.register({ appId: "board", title: "Board", schema: z.object({ webPort: z.number().default(3999) }) })

  const host = makePluginHost()
  await host.register(makeConsolePlugin({ registry: makeEffectRegistry(), configs, yamlOf: () => ({ webPort: 4100 }) }))

  const before = await j<{ kind: string; value: { webPort: number }; sources: Record<string, string> }>(
    await host.handle(req("/console/api/config/board")),
  )
  expect(before.kind).toBe("config")
  expect(before.value.webPort).toBe(4100)
  expect(before.sources.webPort).toBe("yaml")

  const saved = await j<{ ok: boolean }>(
    await host.handle(req("/console/api/config/board", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ override: { webPort: 9999 }, strategy: "apply" }),
    })),
  )
  expect(saved.ok).toBe(true)

  const after = await j<{ value: { webPort: number }; sources: Record<string, string> }>(
    await host.handle(req("/console/api/config/board")),
  )
  expect(after.value.webPort).toBe(9999)
  expect(after.sources.webPort).toBe("override")
})


test("console serves the json-render/react client bundle", async () => {
  const host = makePluginHost()
  await host.register(makeConsolePlugin({ registry: makeEffectRegistry(), configs: makeConfigRegistry() }))
  expect((await host.handle(req("/console"))).status).toBe(200)
  const js = await host.handle(req("/console-client.js"))
  expect(js.status).toBe(200)
  expect(js.headers.get("content-type") ?? "").toStrictEqual("text/javascript; charset=utf-8")
})
