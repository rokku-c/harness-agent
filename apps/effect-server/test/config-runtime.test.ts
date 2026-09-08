import { expect, test } from "bun:test"
import { z } from "@effect-agent/effect-config"
import { memoryConfigs as makeConfigRegistry } from "./config-helpers.ts"
import { makeConfigRuntime } from "../src/config-runtime/runtime.ts"

const setup = (reload?: (id: string) => Promise<void>) => {
  const configs = makeConfigRegistry()
  configs.register({ appId: "worker", schema: z.object({ port: z.number().int().default(100) }) })
  const runtime = makeConfigRuntime(configs, reload)
  runtime.initialize("worker", { yaml: { port: 200 } })
  return { configs, runtime }
}
test("restart strategy preserves active config until explicit apply", async () => {
  let reloads = 0
  const { runtime } = setup(async () => { reloads++ })
  const saved = await runtime.save("worker", { port: 300 }, "restart")
  expect(saved.ok).toBe(true)
  expect(saved.value).toEqual({ port: 300 })
  expect(saved.pendingRestart).toBe(true)
  expect(runtime.active("worker")).toEqual({ port: 200 })
  runtime.initialize("worker", { yaml: { port: 999 } })
  expect(runtime.active("worker")).toEqual({ port: 200 })
  expect((await runtime.apply("worker")).pendingRestart).toBe(false)
  expect(runtime.active("worker")).toEqual({ port: 300 })
  expect(reloads).toBe(1)
})
test("apply strategy reloads using the saved value and invalid saves do nothing", async () => {
  const { runtime } = setup()
  expect((await runtime.save("worker", { port: 300 }, "apply")).pendingRestart).toBe(false)
  const failed = await runtime.save("worker", { port: "bad" }, "apply")
  expect(failed.ok).toBe(false)
  expect(runtime.read("worker").value).toEqual({ port: 300 })
  expect(runtime.active("worker")).toEqual({ port: 300 })
})
test("failed activation preserves old active values and reports saved/pending", async () => {
  let count = 0
  const { runtime } = setup(async () => { if (count++ === 0) throw new Error("reload failed") })
  const out = await runtime.save("worker", { port: 300 }, "apply")
  expect(out.ok).toBe(false)
  expect(out.pendingRestart).toBe(true)
  expect(runtime.active("worker")).toEqual({ port: 200 })
  expect(runtime.read("worker").value).toEqual({ port: 300 })
  expect(count).toBe(2)
})
test("cold boot activates saved config rather than changed YAML", async () => {
  const { configs, runtime } = setup()
  await runtime.save("worker", { port: 300 }, "restart")
  const next = makeConfigRuntime(configs)
  next.initialize("worker", { yaml: { port: 999 } })
  expect(next.active("worker")).toEqual({ port: 300 })
  expect(next.read("worker").pendingRestart).toBe(false)
})
