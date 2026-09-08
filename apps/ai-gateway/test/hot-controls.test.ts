import { expect, test } from "bun:test"
import type { GatewayEvent } from "@effect-agent/ai-gateway"
import { makeAiGatewayEffectPlugin } from "../src/effect-plugin.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("captureBodies and rules use the same active snapshot as provider selection", async () => {
  const events: GatewayEvent[] = []
  let active: unknown = { providers }
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => active, send: stub.send,
    recorder: { record: (event) => { events.push(event) } },
  }).load()
  const body = { model: "m", messages: [{ role: "user", content: "hi" }], stream: true }
  await plane.handle(request(paths[0], body))
  expect(events[0].detail.body).toBeUndefined()
  expect(await stub.requests[0].json()).toEqual(body)
  active = { providers, captureBodies: true, rules: [{ ruleId: "hot", inject: { content: "active control" } }] }
  await plane.handle(request(paths[0], body))
  expect(events[2].detail.body).toEqual(body)
  expect(events[3].detail.ruleId).toBe("hot")
  expect(await stub.requests[1].json()).toEqual({ ...body, messages: [{ role: "system", content: "active control" }, ...body.messages] })
})

test("an in-flight request keeps its snapshot while following requests see a new provider", async () => {
  let active = { providers: [providers[0]] }
  let release!: () => void
  let entered!: () => void
  const waiting = new Promise<void>((resolve) => { release = resolve })
  const ready = new Promise<void>((resolve) => { entered = resolve })
  const stub = stubFetch(async () => { entered(); await waiting; return Response.json({}) })
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => active, send: stub.send }).load()
  const first = plane.handle(request(paths[0]))
  await ready
  active = { providers: [{ ...providers[0], baseURL: "https://changed.test" }] }
  const second = plane.handle(request(paths[0]))
  release()
  await Promise.all([first, second])
  expect(stub.requests.map((r) => r.url)).toEqual([
    "https://chat.example.test/proxy/v1/chat/completions", "https://changed.test/v1/chat/completions",
  ])
})
