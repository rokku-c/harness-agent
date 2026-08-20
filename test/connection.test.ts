import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Connections, HttpConnection } from "../src/index.js"

/** 本地 fake HTTP 服务器：响应固定 JSON，记录收到的请求（method/url/body）。 */
const startServer = (respond: (req: { url: string; method: string; body: unknown }) => unknown) => {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      return req.method === "POST"
        ? req.json().then((body) =>
            new Response(JSON.stringify(respond({ url: req.url, method: req.method, body })), {
              headers: { "content-type": "application/json" }
            })
          )
        : new Response(JSON.stringify(respond({ url: req.url, method: req.method, body: undefined })), {
            headers: { "content-type": "application/json" }
          })
    }
  })
  return {
    url: server.url.toString(),
    stop: () => { server.stop(true) }
  }
}

/** op.execute 的 R 为 any（泛型），满足 runPromise 需 R=never 时手动归零。保留成功类型 A。 */
const run = <A>(effect: Effect.Effect<A, unknown, unknown>): Promise<A> =>
  Effect.runPromise(effect as Effect.Effect<A, never, never>)

describe("Connection 远程接入抽象", () => {
  test("open 产出容器/binding，ops 为声明的远程能力", async () => {
    const server = startServer(() => ({ hello: "world" }))
    try {
      const conn = HttpConnection(server.url)
      const acquired = await run(conn.open)
      expect(acquired.containers).toHaveLength(1)
      expect(acquired.bindings).toHaveLength(1)
      const names = acquired.ops.map((op) => op.name).sort()
      expect(names).toEqual(["http.get", "http.post"])
    } finally {
      server.stop()
    }
  })

  test("http.get op → 对 fake 服务器发 GET，解码返回 JSON（一个 HTTP 请求 = 一个 op）", async () => {
    const requests: Array<{ url: string; method: string }> = []
    const server = startServer((req) => {
      requests.push({ url: req.url, method: req.method })
      return { ok: true, path: "/greet" }
    })
    try {
      const containers = await run(HttpConnection(server.url).open)
      const getOp = containers.ops.find((op) => op.name === "http.get")
      expect(getOp).toBeDefined()
      const value = await run(getOp!.execute({ path: "/greet" }))
      expect(value).toEqual({ ok: true, path: "/greet" })
      expect(requests[0]?.method).toBe("GET")
      expect(requests[0]?.url).toContain("/greet")
    } finally {
      server.stop()
    }
  })

  test("http.post op → 对 fake 服务器发 POST 并带 JSON body", async () => {
    let seen: { method: string; body: unknown } | undefined
    const server = startServer((req) => {
      seen = { method: req.method, body: req.body }
      return { created: true }
    })
    try {
      const containers = await run(HttpConnection(server.url).open)
      const postOp = containers.ops.find((op) => op.name === "http.post")
      expect(postOp).toBeDefined()
      const value = await run(postOp!.execute({ path: "/items", body: { name: "x" } }))
      expect(value).toEqual({ created: true })
      expect(seen?.method).toBe("POST")
      expect(seen?.body).toEqual({ name: "x" })
    } finally {
      server.stop()
    }
  })

  test("request 协议级直呼：直接调 Connection.request 返回 RemoteResponse", async () => {
    const server = startServer(() => ({ pong: "pong" }))
    try {
      const conn = HttpConnection(server.url)
      const response = await Effect.runPromise(conn.request({ method: "http.get", params: { path: "/ping" } }))
      expect(response.value).toEqual({ pong: "pong" })
    } finally {
      server.stop()
    }
  })

  test("Connections.layer 接线：注入多个 Connection，可按 uri resolve", async () => {
    const serverA = startServer(() => ({ service: "a" }))
    const serverB = startServer(() => ({ service: "b" }))
    try {
      const program = Effect.gen(function*() {
        const { resolve } = yield* Connections
        return {
          a: resolve(serverA.url),
          b: resolve(serverB.url)
        }
      }).pipe(Effect.provide(Connections.layer([HttpConnection(serverA.url), HttpConnection(serverB.url)])))
      const { a, b } = await Effect.runPromise(program)
      expect(a._tag).toBe("Some")
      expect(b._tag).toBe("Some")
      if (a._tag === "Some") expect(a.value.uri).toBe(serverA.url)
      if (b._tag === "Some") expect(b.value.uri).toBe(serverB.url)
    } finally {
      serverA.stop()
      serverB.stop()
    }
  })
})
