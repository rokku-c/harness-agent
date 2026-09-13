import { expect, test } from "bun:test"
import { createStateStore } from "@json-render/core"
import { makeActionHandlers } from "../effect-ui-action-runtime.ts"

const response = (body: unknown, status = 200): Response => Response.json(body, { status })

test("declared actions forward resolved params and refresh sources", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    if (calls.length === 1) return response({ uri: "ui://preview", kind: "html", body: "<h1>ok</h1>" })
    return response({ servers: [{ serverId: "one" }] })
  }) as unknown as typeof fetch
  const store = createStateStore({})
  const handlers = makeActionHandlers([
    { name: "preview", method: "GET", url: "/-/registry/preview", result: "/preview", refresh: ["servers"] },
  ], [{ id: "servers", url: "/-/registry/servers", state: "/registry/servers" }], store, () => {}, fetcher, "http://host")

  await handlers.preview({ serverId: "one", uri: "ui://preview" })

  expect(calls[0]?.url).toBe("/-/registry/preview?serverId=one&uri=ui%3A%2F%2Fpreview")
  expect(store.get("/preview")).toEqual({ uri: "ui://preview", kind: "html", body: "<h1>ok</h1>" })
  expect(store.get("/registry/servers")).toEqual({ servers: [{ serverId: "one" }] })
})

test("a path parameter travels in the path only; the rest is the body", async () => {
  const calls: Array<{ url: string; body: unknown }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) })
    return response({ error: "denied" }, 403)
  }) as unknown as typeof fetch
  const store = createStateStore({})
  const handlers = makeActionHandlers([{ name: "move", method: "PATCH", url: "/-/tasks/{taskId}", result: "/result" }], [], store, () => {}, fetcher, "http://host")

  await handlers.move({ taskId: "one", state: "done" })

  // the route's schema is strict, so an id sent again as a field fails the whole request
  expect(calls[0]).toEqual({ url: "/-/tasks/one", body: { state: "done" } })
  expect(store.get("/result")).toEqual({ ok: false, error: "denied" })
})
