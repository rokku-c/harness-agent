import { expect, mock, spyOn, test } from "bun:test"
import { registerEffectApp } from "../src/index.ts"
import { appHost, deferred, descriptor, plane } from "./fixtures.ts"

test("dispose waits for unload, is idempotent, and cleans up in reverse registration order", async () => {
  const host = appHost()
  const events: string[] = []
  const wait = deferred()
  const stopping = deferred()
  const configRegister = host.configs.register
  host.configs.register = (declaration) => {
    const dispose = configRegister(declaration)
    return () => { events.push("config"); dispose() }
  }
  const registerInterface = host.registry.registerInterface
  host.registry.registerInterface = (iface) => {
    const dispose = registerInterface(iface)
    return () => { events.push("interface"); dispose() }
  }
  for (const [map, label] of [[host.uiViews, "view"]] as const) {
    const remove = map.delete.bind(map)
    spyOn(map, "delete").mockImplementation((key) => { events.push(label); return remove(key) })
  }
  const stop = mock(async () => {
    events.push("stop:start"); stopping.resolve(); await wait.promise; events.push("stop:end")
  })
  const dispose = await registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => plane(stop),
  } })
  const first = dispose()
  expect(dispose()).toBe(first)
  await stopping.promise
  expect(events).toEqual(["stop:start"])
  expect(host.registry.find("board")).toBeDefined()
  wait.resolve()
  await first
  await dispose()
  expect(events).toEqual(["stop:start", "stop:end", "interface", "view", "config"])
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.host.list()).toEqual([])
  expect(host.uiViews.size).toBe(0)
})

test("disposal exceptions propagate, subsequent calls share failure, and cleanup continues", async () => {
  const host = appHost()
  const error = new Error("unregister failed")
  const unregister = host.host.unregister
  const remove = mock(async (id: string) => { await unregister(id); throw error })
  host.host.unregister = remove
  const dispose = await registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => plane(),
  } })
  const completion = dispose()
  await expect(completion).rejects.toBe(error)
  expect(dispose()).toBe(completion)
  await expect(dispose()).rejects.toBe(error)
  expect(remove).toHaveBeenCalledTimes(1)
  expect(host.configs.list()).toEqual([])
  expect(host.registry.tools()).toEqual([])
  expect(host.uiViews.size).toBe(0)
})
