import { expect, test } from "bun:test"

import { makePluginHost } from "@effect-agent/effect-host"
import { z } from "@effect-agent/effect-config"
import { memoryConfigs as makeConfigRegistry } from "./config-helpers.ts"
import { makeConfigPlugin } from "../src/config-plugin.ts"

const req = (path: string) => new Request("http://127.0.0.1" + path)
const json = async <T>(r: Response): Promise<T> => (await r.json()) as T

test("config plugin lists declared schemas and merged values over HTTP", async () => {
  const configs = makeConfigRegistry()
  configs.register({
    appId: "board",
    title: "Board",
    schema: z.object({ webPort: z.number().default(3999), dataFile: z.string().default("x") }),
  })

  const host = makePluginHost()
  await host.register(makeConfigPlugin(configs))

  const list = await host.handle(req("/-/config"))
  const apps = await json<Array<{ appId: string; schema?: unknown }>>(list)
  expect(apps.map((a) => a.appId)).toEqual(["board"])
  expect(apps[0].schema).toBeDefined()

  const one = await host.handle(req("/-/config/board"))
  const cfg = await json<{ ok: boolean; value: { webPort: number; dataFile: string }; sources: Record<string, string> }>(one)
  expect(cfg.ok).toBe(true)
  expect(cfg.value).toEqual({ webPort: 3999, dataFile: "x" })
  expect(cfg.sources).toEqual({ webPort: "default", dataFile: "default" })

  const missing = await host.handle(req("/-/config/nope"))
  expect(missing.status).toBe(404)
})
