import { expect, spyOn, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { plane, request } from "./fixtures.ts"

test("HTTP control preserves list/enable/disable/delete payloads and JSON responses", async () => {
  const host = makePluginHost({ control: true })
  await host.register({ id: "app", priority: 7, enabled: false, load: async () => plane() })
  const listed = await host.handle(request("/-/planes"))
  expect(listed.status).toBe(200)
  expect(listed.headers.get("content-type")).toBe("application/json")
  expect(await listed.json()).toEqual([{ id: "app", enabled: false, priority: 7 }])
  for (const [path, body] of [
    ["app/enable", { ok: true, id: "app", enabled: true }],
    ["app/enable", { ok: false, id: "app", enabled: true }],
    ["app/disable", { ok: true, id: "app", enabled: false }],
    ["missing/enable", { ok: false, id: "missing", enabled: false }],
  ] as const) {
    const response = await host.handle(request("/-/planes/" + path, "POST"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body)
  }
  expect(await (await host.handle(request("/-/planes/app", "DELETE"))).json()).toEqual({ ok: true })
  expect(await (await host.handle(request("/-/planes/app", "DELETE"))).json()).toEqual({ ok: false })
  expect(await (await host.handle(request("/-/planes"))).json()).toEqual([])
  await host.close()
})

test("failed enable keeps the existing HTTP false result and disabled state", async () => {
  const host = makePluginHost({ control: true })
  await host.register({ id: "app", enabled: false, load: async () => { throw new Error("load failed") } })
  const log = spyOn(console, "error").mockImplementation(() => undefined)
  try {
    const response = await host.handle(request("/-/planes/app/enable", "POST"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, id: "app", enabled: false })
  } finally { log.mockRestore(); await host.close() }
})

test.each(["disable", "delete"])("HTTP %s reports stop failure instead of claiming success", async (op) => {
  const host = makePluginHost({ control: true })
  await host.register({ id: "app", load: async () => plane(() => { throw new Error("stop failed") }) })
  const response = await host.handle(op === "delete"
    ? request("/-/planes/app", "DELETE") : request("/-/planes/app/disable", "POST"))
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ ok: false, detail: "control error: stop failed" })
  expect(host.isEnabled("app")).toBe(false)
  await host.close()
})
