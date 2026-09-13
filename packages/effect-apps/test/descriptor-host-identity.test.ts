import { expect, mock, test } from "bun:test"
import { registerEffectApp } from "../src/index.ts"
import { appHost, descriptor, plane } from "./fixtures.ts"

test("an old descriptor disposer cannot delete a direct host.register replacement", async () => {
  const host = appHost()
  const oldStop = mock(() => undefined)
  const newStop = mock(() => undefined)
  const dispose = await registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => plane(oldStop),
  } })
  await host.host.register({ id: "board", load: async () => plane(newStop) })
  await dispose()
  expect(oldStop).toHaveBeenCalledTimes(1)
  expect(newStop).not.toHaveBeenCalled()
  expect(host.host.isEnabled("board")).toBe(true)
  expect((await host.host.handle(new Request("http://localhost/"))).status).toBe(200)
  await host.host.close()
  expect(newStop).toHaveBeenCalledTimes(1)
})

test("reusing the same plugin object still gives each descriptor a unique registration identity", async () => {
  const host = appHost()
  const stop = mock(() => undefined)
  const plugin = { id: "board", load: async () => plane(stop) }
  const first = await registerEffectApp(host, { ...descriptor(), plugin })
  const second = await registerEffectApp(host, { ...descriptor(), plugin })
  await first()
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.host.isEnabled("board")).toBe(true)
  await host.host.register(plugin)
  await second()
  expect(stop).toHaveBeenCalledTimes(2)
  expect(host.host.isEnabled("board")).toBe(true)
  await host.host.close()
  expect(stop).toHaveBeenCalledTimes(3)
})

test("a real stop failure rejects descriptor disposal but all metadata is still cleaned", async () => {
  const host = appHost()
  const error = new Error("stop failed")
  const stop = mock(async () => { throw error })
  const dispose = await registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => plane(stop),
  } })
  await expect(dispose()).rejects.toBe(error)
  await expect(dispose()).rejects.toBe(error)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.host.list()).toEqual([])
  expect(host.configs.list()).toEqual([])
  expect(host.registry.tools()).toEqual([])
  expect(host.uiViews.size).toBe(0)
  await host.host.close()
})

test("replacement stop failure does not make rollback unregister the previous identity", async () => {
  const host = appHost()
  const error = new Error("old stop failed")
  const old = { id: "board", load: async () => plane(() => { throw error }) }
  await host.host.register(old)
  await expect(registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => plane(),
  } })).rejects.toBe(error)
  expect(host.host.list()).toEqual([{ id: "board", enabled: false, priority: 100 }])
  expect(await host.host.unregister("board", old)).toBe(true)
  expect(host.registry.tools()).toEqual([])
  expect(host.configs.list()).toEqual([])
  await host.host.close()
})
