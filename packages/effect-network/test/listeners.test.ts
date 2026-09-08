import { expect, test } from "bun:test"
import { makeListenerManager } from "../src/listeners.ts"

test("two real loopback ports expose the same handler and report their allocated addresses", async () => {
  const manager = makeListenerManager({ handle: async request => Response.json({
    path: new URL(request.url).pathname, method: request.method, body: await request.text(),
  }) })
  try {
    await manager.register({ id: "one", port: 0 })
    await manager.register({ id: "two", port: 0 })
    const listeners = manager.list()
    expect(listeners.map(listener => listener.id)).toEqual(["one", "two"])
    expect(listeners[0].port).not.toBe(listeners[1].port)
    for (const listener of listeners) {
      expect(listener.hostname).toBe("127.0.0.1")
      expect(listener.port).not.toBe(0)
      expect(new URL(listener.url).hostname).toBe(listener.hostname)
      expect(Number(new URL(listener.url).port)).toBe(listener.port)
      expect(listener).not.toHaveProperty("apps")
      const response = await fetch(new URL("/shared", listener.url), { method: "POST", body: "same input" })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ path: "/shared", method: "POST", body: "same input" })
    }
  } finally { await manager.close() }
  expect(manager.list()).toEqual([])
})

test("explicit apps filter blocks known apps with 403 and unknown routes with 404", async () => {
  const handled: string[] = []
  const manager = makeListenerManager({
    resolveApp: request => ["board", "gateway"].find(app => new URL(request.url).pathname === `/${app}`),
    handle: async request => {
      const path = new URL(request.url).pathname
      handled.push(path)
      return Response.json({ path })
    },
  })
  const apps = ["board"]
  try {
    await manager.register({ id: "all", port: 0 })
    await manager.register({ id: "board-only", port: 0, apps })
    const [all, filtered] = manager.list()
    apps.push("gateway")
    ;(filtered.apps as string[]).push("gateway")
    expect(manager.list()[1].apps).toEqual(["board"])
    expect((await fetch(new URL("/gateway", all.url))).status).toBe(200)
    const allowed = await fetch(new URL("/board", filtered.url))
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual({ path: "/board" })
    expect((await fetch(new URL("/gateway", filtered.url))).status).toBe(403)
    expect((await fetch(new URL("/unknown", filtered.url))).status).toBe(404)
    expect(handled).toEqual(["/gateway", "/board"])
  } finally { await manager.close() }
})

test("filter registration requires resolveApp, including an explicitly empty allowlist", async () => {
  let binds = 0
  const manager = makeListenerManager({ handle: async () => new Response(), listen: () => {
    binds++
    throw new Error("must not bind")
  } })
  for (const apps of [[], ["board"]]) {
    await expect(manager.register({ id: "filtered", port: 0, apps })).rejects.toThrow("requires resolveApp")
  }
  expect(binds).toBe(0)
  expect(manager.list()).toEqual([])
  await manager.close()
})
