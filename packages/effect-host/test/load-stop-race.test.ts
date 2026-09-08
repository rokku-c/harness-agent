import { expect, mock, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { deferred, plane, request } from "./fixtures.ts"

test.each(["disable", "unregister"] as const)("%s waits for pending registration load before stopping", async (op) => {
  const host = makePluginHost()
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const stop = mock(() => undefined)
  const completed = mock(() => undefined)
  const registration = host.register({ id: "app", load: () => { started.resolve(); return loading.promise } })
  await started.promise
  const mutation = host[op]("app").then((result) => { completed(); return result })
  // Independent ids continue and give queued same-id operations a chance to run.
  await host.register({ id: "other", enabled: false, load: async () => plane() })
  expect(completed).not.toHaveBeenCalled()
  expect(stop).not.toHaveBeenCalled()
  loading.resolve(plane(stop))
  await registration
  expect(await mutation).toBe(true)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.isEnabled("app")).toBe(false)
  expect((await host.handle(request())).status).toBe(404)
  await host.close()
})

test("replacement awaits the previous load and asynchronous stop before loading", async () => {
  const host = makePluginHost()
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const stopping = deferred()
  const stopped = deferred()
  const events: string[] = []
  const first = host.register({ id: "app", load: () => {
    events.push("old:load"); started.resolve(); return loading.promise
  } })
  await started.promise
  const replacement = host.register({ id: "app", load: async () => {
    events.push("new:load"); return plane(undefined, "new")
  } })
  await host.register({ id: "other", enabled: false, load: async () => plane() })
  expect(events).toEqual(["old:load"])
  loading.resolve(plane(async () => {
    events.push("old:stop:start"); stopping.resolve(); await stopped.promise; events.push("old:stop:end")
  }))
  await stopping.promise
  expect(events).toEqual(["old:load", "old:stop:start"])
  expect((await host.handle(request())).status).toBe(404)
  stopped.resolve()
  await Promise.all([first, replacement])
  expect(events).toEqual(["old:load", "old:stop:start", "old:stop:end", "new:load"])
  expect(await (await host.handle(request())).text()).toBe("new")
  await host.close()
})
