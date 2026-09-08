import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("request bytes and progressive SSE response are not buffered or rewritten", async () => {
  for (const path of paths) {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({ start: (value) => { controller = value } })
    const response = new Response(stream, { headers: { "content-type": "text/event-stream" } })
    const stub = stubFetch(() => response)
    const handle = makeAiGatewayHandler({ getConfig: () => ({ providers }), send: stub.send })
    const body = '{ "model": "any-model", "stream": true, "metadata": { "keep": 1 } }\n'
    const result = await handle(new Request(`http://gateway.test${path}`, { method: "POST", body }))
    expect(result).toBe(response)
    expect(await stub.requests[0].text()).toBe(body)
    expect(result.headers.get("content-type")).toBe("text/event-stream")
    const reader = result.body!.getReader()
    controller.enqueue(new TextEncoder().encode("data: first\n\n"))
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: first\n\n")
    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
    controller.close()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: [DONE]\n\n")
    expect((await reader.read()).done).toBe(true)
  }
})

test("chat-only control rules do not inject invalid system messages into Anthropic or Responses", async () => {
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers, captureBodies: true,
    rules: [{ ruleId: "chat-control", inject: { content: "control" } }],
  }), send: stub.send })
  const body = { model: "any", stream: true, messages: [{ role: "user", content: "hi" }] }
  for (const path of paths.slice(1)) await handle(request(path, body))
  for (const outgoing of stub.requests) expect(await outgoing.json()).toEqual(body)
})
