import { expect, test } from "bun:test"
import { startAiGateway } from "../src/standalone.ts"
import { paths, providers } from "./helpers.ts"

test("real HTTP stub upstreams receive three distinct provider URLs, headers, and stream bodies", async () => {
  const received: Array<{ url: string; headers: Headers; body: unknown }> = []
  const upstreams = providers.map(() => Bun.serve({ port: 0, fetch: async (request) => {
    received.push({ url: request.url, headers: request.headers, body: await request.json() })
    return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
  } }))
  const configured = providers.map((provider, index) => ({ ...provider,
    baseURL: new URL(index === 1 ? "/prefix/v1/" : "/", upstreams[index].url).toString(),
  }))
  const gateway = startAiGateway({ port: 0, providers: configured, recorder: { record: () => undefined } })
  try {
    for (const [index, path] of paths.entries()) {
      const body = { model: "not-a-routing-key", stream: true }
      const response = await fetch(new URL(`${path}?trace=a%2Fb&trace=c`, gateway.url), {
        method: "POST", body: JSON.stringify(body),
        headers: { authorization: "Bearer client-test-key", "x-api-key": "client-test-key", "x-agent-id": "internal" },
      })
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/event-stream")
      expect(await response.text()).toBe("data: [DONE]\n\n")
      expect(received[index].url).toBe(new URL(`${index === 1 ? "/prefix" : ""}${path}?trace=a%2Fb&trace=c`, upstreams[index].url).toString())
      expect(received[index].body).toEqual(body)
      expect(received[index].headers.get("authorization")).toBe(index < 2 ? `Bearer ${providers[index].apiKey}` : null)
      expect(received[index].headers.get("x-api-key")).toBe(index === 2 ? "messages-key" : null)
      expect(received[index].headers.get("anthropic-version")).toBe(index === 2 ? "2023-06-01" : null)
      expect(received[index].headers.get("x-agent-id")).toBeNull()
    }
  } finally { await gateway.stop(true); await Promise.all(upstreams.map((server) => server.stop(true))) }
})

test("upstream errors are returned unchanged and redirects do not carry keys to another host", async () => {
  let leaked = false
  const target = Bun.serve({ port: 0, fetch: () => { leaked = true; return Response.json({}) } })
  const upstream = Bun.serve({ port: 0, fetch: (request) => new URL(request.url).searchParams.has("redirect")
    ? Response.redirect(target.url.toString(), 307) : Response.json({ error: "rate-limited" }, { status: 429, headers: { "retry-after": "2" } }),
  })
  const gateway = startAiGateway({ port: 0, providers: [{ ...providers[0], baseURL: upstream.url.toString() }], recorder: { record: () => undefined } })
  try {
    const error = await fetch(new URL(paths[0], gateway.url), { method: "POST", body: "{}" })
    expect(error.status).toBe(429)
    expect(error.headers.get("retry-after")).toBe("2")
    expect(await error.json()).toEqual({ error: "rate-limited" })
    const redirect = await fetch(new URL(`${paths[0]}?redirect`, gateway.url), { method: "POST", body: "{}", redirect: "manual" })
    expect(redirect.status).toBe(307)
    expect(redirect.headers.get("location")).toBe(target.url.toString())
    expect(leaked).toBe(false)
  } finally { await gateway.stop(true); await upstream.stop(true); await target.stop(true) }
})
