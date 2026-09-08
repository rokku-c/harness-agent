import { expect, mock, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { deferred, plane } from "./fixtures.ts"

test("close includes queued registrations not yet visible in list and waits for load/stop", async () => {
  const host = makePluginHost()
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const stop = mock(() => undefined)
  const done = mock(() => undefined)
  const registration = host.register({ id: "app", load: () => { started.resolve(); return loading.promise } })
  const closing = host.close()
  const completion = closing.then(done)
  expect(host.close()).toBe(closing)
  await started.promise
  expect(done).not.toHaveBeenCalled()
  await expect(host.register({ id: "late", load: async () => plane() })).rejects.toThrow("closed")
  await expect(host.enable("app")).rejects.toThrow("closed")
  loading.resolve(plane(stop))
  await Promise.all([registration, completion])
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.list()).toEqual([])
})

test("close stops other plugins even while one plugin's load remains pending", async () => {
  const host = makePluginHost()
  const otherStopped = deferred()
  await host.register({ id: "other", load: async () => plane(() => otherStopped.resolve()) })
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const stop = mock(() => undefined)
  const registration = host.register({ id: "slow", load: () => { started.resolve(); return loading.promise } })
  await started.promise
  const closing = host.close()
  await otherStopped.promise
  expect(stop).not.toHaveBeenCalled()
  loading.resolve(plane(stop))
  await Promise.all([registration, closing])
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.list()).toEqual([])
})
