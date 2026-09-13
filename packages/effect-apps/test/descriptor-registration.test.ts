import { expect, mock, test } from "bun:test"
import { registerEffectApp } from "../src/index.ts"
import { appHost, deferred, descriptor, plane } from "./fixtures.ts"

const expectEmpty = (host: ReturnType<typeof appHost>) => {
  expect(host.configs.list()).toEqual([])
  expect(host.registry.tools()).toEqual([])
  expect([...host.uiViews]).toEqual([])
  expect(host.host.list()).toEqual([])
}

test("registration waits for async load, then returns an awaited disposer", async () => {
  const host = appHost()
  const load = deferred<ReturnType<typeof plane>>()
  const started = deferred()
  let completed = false
  const registration = registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: () => { started.resolve(); return load.promise },
  } }).then((dispose) => { completed = true; return dispose })
  await started.promise
  expect(completed).toBe(false)
  expect((await host.host.handle(new Request("http://localhost/"))).status).toBe(404)
  load.resolve(plane())
  const dispose = await registration
  expect(completed).toBe(true)
  expect((await host.host.handle(new Request("http://localhost/"))).status).toBe(200)
  await dispose()
  expectEmpty(host)
})

test("async plugin load failure rolls back every metadata registration and plugin entry", async () => {
  const host = appHost()
  const load = deferred<ReturnType<typeof plane>>()
  const started = deferred()
  const error = new Error("load failed")
  const registration = registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: () => { started.resolve(); return load.promise },
  } })
  const rejected = registration.catch((error: unknown) => error)
  await started.promise
  expect(host.configs.get("board")).toBeDefined()
  load.reject(error)
  expect(await rejected).toBe(error)
  expectEmpty(host)
})

test("descriptor UI rejects undeclared nodes and arbitrary embeds before registration", async () => {
  const host = appHost()
  const bad = { viewId: "bad", nodes: [{ kind: "embed", src: "data:text/html,<script></script>", title: "Bad" }] }
  await expect(registerEffectApp(host, { ...descriptor(), ui: bad as never })).rejects.toThrow()
  expectEmpty(host)
})

test("config initialization failure stops before metadata or factory and removes schema", async () => {
  const host = appHost()
  const createPlugin = mock(() => ({ id: "board", load: async () => plane() }))
  const error = new Error("initialization failed")
  await expect(registerEffectApp({ ...host, initializeConfig: () => { throw error } }, {
    ...descriptor(), createPlugin,
  })).rejects.toBe(error)
  expect(createPlugin).not.toHaveBeenCalled()
  expectEmpty(host)
})

test("factory failure rolls back metadata without registering the fallback plugin", async () => {
  const host = appHost()
  const load = mock(async () => plane())
  const error = new Error("factory failed")
  await expect(registerEffectApp(host, { ...descriptor(), plugin: { id: "board", load },
    createPlugin: () => { throw error },
  })).rejects.toBe(error)
  expect(load).not.toHaveBeenCalled()
  expectEmpty(host)
})

test("load and rollback exceptions are both preserved while other cleanup still runs", async () => {
  const host = appHost()
  const loadError = new Error("load failed")
  const rollbackError = new Error("unregister failed")
  const unregister = host.host.unregister
  host.host.unregister = async (id) => { await unregister(id); throw rollbackError }
  const result = await registerEffectApp(host, { ...descriptor(), plugin: {
    id: "board", load: async () => { throw loadError },
  } }).catch((error: unknown) => error)
  expect(result).toBeInstanceOf(AggregateError)
  expect((result as AggregateError).errors).toEqual([loadError, rollbackError])
  expectEmpty(host)
})
