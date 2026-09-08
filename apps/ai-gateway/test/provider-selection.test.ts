import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

const repeated = providers.flatMap(provider => ["east", "west", "local"].map(zone => ({
  ...provider, id: `${provider.id}-${zone}`, baseURL: `http://${provider.id}-${zone}.test`,
})))
const hosts = (requests: Request[]) => requests.map(input => new URL(input.url).hostname)

test("same-protocol round-robin is independent across protocols and handler instances", async () => {
  const stub = stubFetch()
  const options = { getConfig: () => ({ providers: structuredClone(repeated) }), send: stub.send }
  const handle = makeAiGatewayHandler(options)
  for (let round = 0; round < 4; round++) {
    for (const path of paths) expect((await handle(request(path))).status).toBe(200)
  }
  expect(hosts(stub.requests)).toEqual(["east", "west", "local", "east"].flatMap(zone =>
    providers.map(provider => `${provider.id}-${zone}.test`)))
  const second = makeAiGatewayHandler(options)
  await second(request(paths[0]))
  await handle(request(paths[0]))
  expect(hosts(stub.requests.slice(-2))).toEqual(["chat-east.test", "chat-west.test"])
})

test("parallel requests reserve consecutive cursor positions before awaiting upstream", async () => {
  const stub = stubFetch(async () => { await Bun.sleep(5); return Response.json({}) })
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: repeated }), send: stub.send })
  await Promise.all(Array.from({ length: 6 }, () => handle(request(paths[0]))))
  expect(hosts(stub.requests)).toEqual(["chat-east.test", "chat-west.test", "chat-local.test",
    "chat-east.test", "chat-west.test", "chat-local.test"])
})

test("explicit ID selects exactly that upstream and is consumed before any protocol's send", async () => {
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: repeated }), send: stub.send })
  for (const [index, path] of paths.entries()) {
    for (const zone of ["west", "local"]) {
      expect((await handle(request(path, {}, { "X-Upstream-ID": `${providers[index].id}-${zone}` }))).status).toBe(200)
    }
    await handle(request(path))
  }
  expect(hosts(stub.requests)).toEqual(providers.flatMap(provider =>
    ["west", "local", "east"].map(zone => `${provider.id}-${zone}.test`)))
  for (const input of stub.requests) expect(input.headers.has("x-upstream-id")).toBe(false)
})

test("disabled providers are skipped, and an all-disabled protocol sends nothing", async () => {
  const configured = repeated.map(provider => ({ ...provider, enabled: !provider.id.endsWith("west") }))
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: configured }), send: stub.send })
  for (let i = 0; i < 3; i++) await handle(request(paths[0]))
  expect(hosts(stub.requests)).toEqual(["chat-east.test", "chat-local.test", "chat-east.test"])
  configured.forEach(provider => { provider.enabled = false })
  const response = await handle(request(paths[0]))
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ error: { type: "provider_not_configured" } })
  expect(stub.requests.length).toBe(3)
})

test("unknown, empty, disabled and wrong-protocol IDs fail with explicit 4xx and no fallback", async () => {
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: [
    ...repeated, { ...providers[0], id: "disabled", enabled: false },
  ] }), send: stub.send })
  for (const [id, status, type] of [
    ["missing", 404, "upstream_not_found"], ["", 404, "upstream_not_found"],
    ["disabled", 403, "upstream_disabled"], ["responses-east", 400, "upstream_protocol_mismatch"],
  ] as const) {
    const response = await handle(request(paths[0], {}, { "x-upstream-id": id }))
    expect(response.status).toBe(status)
    const body = await response.json()
    expect(body.error.type).toBe(type)
    expect(body.error.message).toContain(`'${id}'`)
  }
  expect(stub.requests).toEqual([])
  await handle(request(paths[0]))
  expect(hosts(stub.requests)).toEqual(["chat-east.test"])
})
