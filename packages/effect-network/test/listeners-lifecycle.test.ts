import { expect, test } from "bun:test"
import { connect } from "node:net"
import { makeListenerManager } from "../src/listeners.ts"

const acceptsConnections = (port: number): Promise<boolean> => new Promise(resolve => {
  const socket = connect({ host: "127.0.0.1", port })
  socket.once("connect", () => { socket.destroy(); resolve(true) })
  socket.once("error", () => { socket.destroy(); resolve(false) })
})

test("duplicate IDs reject; disposers are idempotent and cannot remove a replacement listener", async () => {
  const manager = makeListenerManager({ handle: async () => Response.json({ ok: true }) })
  try {
    const remove = await manager.register({ id: "same", port: 0 })
    const first = manager.list()[0]
    await expect(manager.register({ id: "same", port: 0 })).rejects.toThrow("duplicate listener id")
    expect(manager.list()).toEqual([first])
    await remove(); await remove()
    expect(manager.list()).toEqual([])
    expect(await acceptsConnections(first.port)).toBe(false)
    await manager.register({ id: "same", port: 0 })
    await remove()
    expect(manager.list().map(listener => listener.id)).toEqual(["same"])
    expect(await (await fetch(manager.list()[0].url)).json()).toEqual({ ok: true })
  } finally { await manager.close() }
})

test("close stops all real listening sockets, is idempotent, and rejects future registrations", async () => {
  const manager = makeListenerManager({ handle: async () => new Response() })
  const remove = await manager.register({ id: "one", port: 0 })
  await manager.register({ id: "two", port: 0 })
  const ports = manager.list().map(listener => listener.port)
  try {
    const closing = manager.close()
    expect(manager.close()).toBe(closing)
    await closing
    await remove()
    expect(manager.list()).toEqual([])
    for (const port of ports) expect(await acceptsConnections(port)).toBe(false)
    await expect(manager.register({ id: "three", port: 0 })).rejects.toThrow("closed")
  } finally { await manager.close() }
})

test("self-port close returns without deadlock while an existing stream continues naturally", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const encoder = new TextEncoder()
  const manager = makeListenerManager({ handle: async request => {
    if (new URL(request.url).pathname === "/close") {
      await manager.close()
      return Response.json({ closed: true })
    }
    return new Response(new ReadableStream<Uint8Array>({ start(value) {
      controller = value
      controller.enqueue(encoder.encode("data: before\n\n"))
    } }), { headers: { "content-type": "text/event-stream" } })
  } })
  await manager.register({ id: "control-and-stream", port: 0 })
  const listener = manager.list()[0]
  let cancel: (() => Promise<void>) | undefined
  try {
    const stream = await fetch(new URL("/events", listener.url), { signal: AbortSignal.timeout(3000) })
    const reader = stream.body!.getReader()
    cancel = () => reader.cancel()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: before\n\n")
    const closed = await fetch(new URL("/close", listener.url), { signal: AbortSignal.timeout(1000) })
    expect(closed.status).toBe(200)
    expect(await closed.json()).toEqual({ closed: true })
    expect(manager.list()).toEqual([])
    expect(await acceptsConnections(listener.port)).toBe(false)
    controller.enqueue(encoder.encode("data: after\n\n"))
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: after\n\n")
    controller.close()
    expect((await reader.read()).done).toBe(true)
  } finally {
    try { controller?.close() } catch {}
    await cancel?.()
    await manager.close()
  }
}, 5000)
