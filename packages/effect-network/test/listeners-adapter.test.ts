import { expect, test } from "bun:test"
import { makeListenerManager, type ListenerManagerOptions } from "../src/listeners.ts"

test("adapter receives the shared handler and graceful stop is called once without waiting for drainage", async () => {
  const binds: Parameters<NonNullable<ListenerManagerOptions["listen"]>>[0][] = []
  const stops: boolean[] = []
  let finish!: () => void
  const drained = new Promise<void>(resolve => { finish = resolve })
  const handle = async () => new Response()
  const manager = makeListenerManager({ handle, listen: options => {
    binds.push(options)
    return { hostname: options.hostname, port: 12345, url: new URL("http://127.0.0.1:12345"),
      stop(force) { stops.push(force!); return drained },
    }
  } })
  try {
    const remove = await manager.register({ id: "injected", port: 0 })
    expect(binds).toEqual([{ hostname: "127.0.0.1", port: 0, fetch: handle }])
    await remove(); await remove(); await manager.close(); await manager.close()
    expect(stops).toEqual([false])
    expect(manager.list()).toEqual([])
  } finally { finish(); await manager.close() }
})

test("bind failure releases the reserved ID; close attempts all servers even if one stop throws", async () => {
  let attempts = 0
  const stopped: string[] = []
  const manager = makeListenerManager({ handle: async () => new Response(), listen: options => {
    if (++attempts === 1) throw new Error("bind failed")
    return { hostname: options.hostname, port: options.port, url: `http://${options.hostname}:${options.port}`,
      stop(force) {
        expect(force).toBe(false)
        stopped.push(String(options.port))
        if (options.port === 1) throw new Error("stop failed")
      },
    }
  } })
  await expect(manager.register({ id: "retry", port: 1 })).rejects.toThrow("bind failed")
  await manager.register({ id: "retry", port: 1 })
  await manager.register({ id: "other", port: 2 })
  const closing = manager.close()
  await expect(closing).rejects.toThrow("listener shutdown failed")
  expect(manager.close()).toBe(closing)
  expect(stopped).toEqual(["1", "2"])
  expect(manager.list().map(listener => listener.id)).toEqual(["retry"])
})
