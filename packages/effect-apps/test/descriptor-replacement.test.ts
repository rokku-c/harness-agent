import { expect, mock, test } from "bun:test"
import { registerEffectApp } from "../src/index.ts"
import { appHost, deferred, descriptor, plane } from "./fixtures.ts"

test("old disposer cannot remove replacement UI/config/interface/plugin, even identical values", async () => {
  const host = appHost()
  const oldStop = mock(() => undefined)
  const newStop = mock(() => undefined)
  const app = descriptor()
  const oldDispose = await registerEffectApp(host, { ...app, plugin: {
    id: "board", load: async () => plane(oldStop),
  } })
  const newDispose = await registerEffectApp({ ...host }, { ...app, plugin: {
    id: "board", load: async () => plane(newStop),
  } })
  expect(oldStop).toHaveBeenCalledTimes(1)
  await oldDispose()
  expect(host.uiViews.get("board")).toBe(app.ui)
  expect(host.configs.get("board")).toBeDefined()
  expect(host.registry.tools().map((entry) => entry.key)).toEqual(["board.echo"])
  expect(host.host.isEnabled("board")).toBe(true)
  expect(newStop).not.toHaveBeenCalled()
  await newDispose()
  await oldDispose()
  expect(newStop).toHaveBeenCalledTimes(1)
  expect(host.configs.list()).toEqual([])
  expect(host.registry.tools()).toEqual([])
  expect(host.uiViews.size).toBe(0)
  expect(host.host.list()).toEqual([])
})

test("new-then-old disposal leaves no resurrected metadata or plugin", async () => {
  const host = appHost()
  const first = await registerEffectApp(host, descriptor())
  const second = await registerEffectApp(host, { ...descriptor(), ui: { viewId: "replacement", nodes: [] } })
  await second()
  await first()
  expect(host.uiViews.size).toBe(0)
  expect(host.registry.tools()).toEqual([])
  expect(host.configs.list()).toEqual([])
})

test("an old disposer queued during replacement load cannot unregister the new generation", async () => {
  const host = appHost()
  const oldDispose = await registerEffectApp(host, { id: "board", plugin: {
    id: "board", load: async () => plane(),
  } })
  const loading = deferred()
  const loaded = deferred<ReturnType<typeof plane>>()
  const newStop = mock(() => undefined)
  const replacement = registerEffectApp(host, { id: "board", plugin: {
    id: "board", load: () => { loading.resolve(); return loaded.promise },
  } })
  await loading.promise
  const oldDone = oldDispose()
  loaded.resolve(plane(newStop))
  const newDispose = await replacement
  await oldDone
  expect(host.host.isEnabled("board")).toBe(true)
  expect(newStop).not.toHaveBeenCalled()
  await newDispose()
  expect(newStop).toHaveBeenCalledTimes(1)
})

test("failed pending registration cannot roll back a newer app's metadata", async () => {
  const host = appHost()
  const app = descriptor()
  const started = deferred()
  const loading = deferred<ReturnType<typeof plane>>()
  const error = new Error("old load failed")
  const failed = registerEffectApp(host, { ...app, plugin: {
    id: "board", load: () => { started.resolve(); return loading.promise },
  } }).catch((error: unknown) => error)
  await started.promise
  const replacement = registerEffectApp(host, { ...app, plugin: {
    id: "board", load: async () => plane(),
  } })
  loading.reject(error)
  expect(await failed).toBe(error)
  const dispose = await replacement
  expect(host.uiViews.get("board")).toBe(app.ui)
  expect(host.registry.find("board")).toBeDefined()
  expect(host.configs.get("board")).toBeDefined()
  expect(host.host.isEnabled("board")).toBe(true)
  await dispose()
  expect(host.host.list()).toEqual([])
})
