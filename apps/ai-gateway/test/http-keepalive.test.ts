import { expect, test } from "bun:test"
import { Agent, request as httpRequest } from "node:http"
import type { GatewayEvent } from "@effect-agent/ai-gateway"
import { startAiGateway } from "../src/standalone.ts"
import { paths, providers } from "./helpers.ts"

type EchoResponse = { status: number; echo: unknown; localPort: number | undefined }
const post = (url: URL, raw: string, agent: Agent): Promise<EchoResponse> => new Promise((resolve, reject) => {
  const outgoing = httpRequest(url, { method: "POST", agent, headers: {
    "content-type": "application/json", "content-length": Buffer.byteLength(raw),
  } }, (response) => {
    const localPort = response.socket.localPort
    const chunks: Buffer[] = []
    response.on("data", (chunk: Buffer) => { chunks.push(chunk) })
    response.on("error", reject)
    response.on("end", () => {
      try { resolve({ status: response.statusCode!, echo: JSON.parse(Buffer.concat(chunks).toString()), localPort }) }
      catch (cause) { reject(cause) }
    })
  })
  outgoing.on("error", reject)
  outgoing.end(raw)
})

test("captureBodies preserves consecutive chat/messages bodies over reused client and upstream HTTP connections", async () => {
  const upstreamPeers = new Set<string>()
  const received: Array<{ path: string; raw: string; body: unknown }> = []
  const upstream = Bun.serve({ port: 0, fetch: async (input, server) => {
    const peer = server.requestIP(input)
    if (peer) upstreamPeers.add(`${peer.address}:${peer.port}`)
    // A real HTTP fixture must drain the request before replying on a reusable connection.
    const raw = await input.text()
    if (!raw) return Response.json({ error: "empty body" }, { status: 400 })
    const echo = { path: new URL(input.url).pathname, raw, body: JSON.parse(raw) as unknown }
    received.push(echo)
    return Response.json(echo)
  } })
  const events: GatewayEvent[] = []
  const gateway = startAiGateway({ port: 0, captureBodies: true,
    providers: [providers[0], providers[2]].map((provider) => ({ ...provider, baseURL: upstream.url.toString() })),
    recorder: { record: (event) => { events.push(event) } },
  })
  const agent = new Agent({ keepAlive: true, maxSockets: 1 })
  const clientPorts = new Set<number>()
  const expected: typeof received = []
  try {
    // Both protocol transitions and return-to-chat are exercised on the same connections.
    for (const [index, path] of [paths[0], paths[2], paths[0], paths[2]].entries()) {
      const body = { model: "same-model", stream: true, max_tokens: 8,
        messages: [{ role: "user", content: `连续请求 ${index}` }],
      }
      const raw = JSON.stringify(body, null, 2) + "\n"
      const echo = { path, raw, body }
      expected.push(echo)
      const response = await post(new URL(path, gateway.url), raw, agent)
      expect(response.status).toBe(200)
      expect(response.echo).toEqual(echo)
      expect(response.localPort).toBeDefined()
      clientPorts.add(response.localPort!)
    }
    expect(received).toEqual(expected)
    expect(events.filter((event) => event.type === "request").map((event) => event.detail.body))
      .toEqual(expected.map((echo) => echo.body))
    expect(events.filter((event) => event.type === "error")).toEqual([])
    expect(clientPorts.size).toBe(1)
    expect(upstreamPeers.size).toBe(1)
  } finally { agent.destroy(); await gateway.stop(true); await upstream.stop(true) }
})
