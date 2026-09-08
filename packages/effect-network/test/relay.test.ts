import { expect, test } from "bun:test"
import { makeEgressRouter } from "../src/egress.ts"

const token = "test-relay-secret"
test("relay authenticates node separately from target and preserves stream bytes", async () => {
  let received: Request | undefined
  const main = makeEgressRouter({ role: "main", relayToken: token, localSend: async (input) => {
    received = input as Request
    expect(await received.text()).toBe("body")
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("chunk")); c.close() } }), {
      headers: { "content-type": "text/event-stream" },
    })
  } })
  main.registerApp("app")
  const peer = makeEgressRouter({ role: "peer", localAvailable: false, main: { url: "https://main.invalid", token },
    relaySend: async (input) => main.handleRelay(input as Request),
  })
  peer.registerApp("app", "main-only")
  const response = await peer.fetch("app", "https://upstream.invalid/path?q=1", {
    method: "POST", headers: { authorization: "Bearer target", "x-effect-app": "spoof", "x-agent-id": "private" }, body: "body",
  })
  expect(response.headers.get("content-type")).toBe("text/event-stream")
  expect(await response.text()).toBe("chunk")
  expect(received?.url).toBe("https://upstream.invalid/path?q=1")
  expect(received?.headers.get("authorization")).toBe("Bearer target")
  expect(received?.headers.get("x-agent-id")).toBeNull()
  expect(received?.headers.get("x-effect-app")).toBeNull()
})
test("missing identity, unknown apps, local-only policy, bad targets never reach upstream", async () => {
  let calls = 0
  const main = makeEgressRouter({ role: "main", relayToken: token, localSend: async () => { calls++; return new Response("bad") } })
  main.registerApp("local", "local-only"); main.registerApp("app")
  const request = (app: string, auth = token, target = "https://target.invalid") => main.handleRelay(new Request("http://main/-/network/egress", {
    headers: { authorization: `Bearer ${auth}`, "x-effect-app": app, "x-effect-target-url": target,
      "x-effect-target-headers": Buffer.from("[]").toString("base64") },
  }))
  expect((await request("app", "bad")).status).toBe(401)
  expect((await request("unknown")).status).toBe(403)
  expect((await request("local")).status).toBe(403)
  expect((await request("app", token, "file:///etc/passwd")).status).toBe(400)
  expect((await request("app", token, "https://user:password@target.invalid")).status).toBe(400)
  expect(calls).toBe(0)
})
