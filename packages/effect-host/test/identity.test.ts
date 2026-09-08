import { expect, mock, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { deferred, plane, request } from "./fixtures.ts"

test("unregister checks exact plugin identity; stale identity leaves the replacement running", async () => {
  const host = makePluginHost()
  const oldStop = mock(() => undefined)
  const newStop = mock(() => undefined)
  const old = { id: "app", load: async () => plane(oldStop) }
  const current = { id: "app", load: async () => plane(newStop, "new") }
  await host.register(old)
  await host.register(current)
  expect(oldStop).toHaveBeenCalledTimes(1)
  expect(await host.unregister("app", old)).toBe(false)
  expect(await host.unregister("app", { ...current })).toBe(false)
  expect(newStop).not.toHaveBeenCalled()
  expect(await (await host.handle(request())).text()).toBe("new")
  expect(await host.unregister("app", current)).toBe(true)
  expect(newStop).toHaveBeenCalledTimes(1)
  expect(await host.unregister("app", current)).toBe(false)
  await host.close()
})

test("identity is checked inside the queue after pending replacement finishes loading", async () => {
  const host = makePluginHost()
  const old = { id: "app", load: async () => plane() }
  await host.register(old)
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const stop = mock(() => undefined)
  const registration = host.register({ id: "app", load: () => { started.resolve(); return loading.promise } })
  await started.promise
  const removed = host.unregister("app", old)
  loading.resolve(plane(stop))
  await registration
  expect(await removed).toBe(false)
  expect(host.isEnabled("app")).toBe(true)
  expect(stop).not.toHaveBeenCalled()
  await host.close()
  expect(stop).toHaveBeenCalledTimes(1)
})
