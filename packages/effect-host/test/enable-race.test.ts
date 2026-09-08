import { expect, mock, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { deferred, plane } from "./fixtures.ts"

test.each(["disable", "unregister"] as const)("%s queues behind an asynchronous enable", async (op) => {
  const host = makePluginHost()
  const started = deferred()
  const loaded = deferred<ReturnType<typeof plane>>()
  const stop = mock(() => undefined)
  const load = mock(() => { started.resolve(); return loaded.promise })
  await host.register({ id: "app", enabled: false, load })
  const enabled = host.enable("app")
  await started.promise
  const secondEnable = host.enable("app")
  const changed = host[op]("app")
  loaded.resolve(plane(stop))
  expect(await enabled).toBe(true)
  expect(await secondEnable).toBe(false)
  expect(await changed).toBe(true)
  expect(load).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
  await host.close()
})

test("enable waits for a prior asynchronous disable stop before reloading", async () => {
  const host = makePluginHost()
  const stopping = deferred()
  const stopped = deferred()
  const load = mock(async () => plane(async () => { stopping.resolve(); await stopped.promise }))
  await host.register({ id: "app", load })
  const disabled = host.disable("app")
  await stopping.promise
  const enabled = host.enable("app")
  await host.register({ id: "other", enabled: false, load: async () => plane() })
  expect(load).toHaveBeenCalledTimes(1)
  stopped.resolve()
  expect(await disabled).toBe(true)
  expect(await enabled).toBe(true)
  expect(load).toHaveBeenCalledTimes(2)
  await host.close()
})

test("a failed queued load does not poison subsequent same-id operations", async () => {
  const host = makePluginHost()
  const error = new Error("load failed")
  const failed = host.register({ id: "app", load: async () => { throw error } }).catch((error) => error)
  const next = host.register({ id: "app", load: async () => plane() })
  expect(await failed).toBe(error)
  await next
  expect(host.isEnabled("app")).toBe(true)
  await host.close()
})
