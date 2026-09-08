import { expect, test } from "bun:test"
import { makeRegistry, makeRegistryAuth, makeRegistryHandler } from "../src/index.ts"
const server = { serverId: "files", name: "files", version: "1", era: "modern" as const, transport: { kind: "streamable-http" as const, endpoint: "https://files" } }
test("registry HTTP control plane authenticates announce heartbeat and withdraw", async () => {
  const registry = makeRegistry({ auth: makeRegistryAuth({ files: "secret" }) }), handle = makeRegistryHandler(registry)
  const req = (path: string, init?: RequestInit) => handle(new Request(`http://registry${path}`, init))
  const bad = await req("/-/registry/announce", { method: "POST", body: JSON.stringify(server), headers: { "content-type": "application/json" } }); expect(bad.status).toBe(401)
  const announced = await req("/-/registry/announce", { method: "POST", body: JSON.stringify(server), headers: { authorization: "Bearer secret", "content-type": "application/json" } }); expect(announced.status).toBe(201)
  expect((await (await req("/-/registry/servers")).json()).servers[0].serverId).toBe("files")
  expect((await req("/-/registry/heartbeat", { method: "POST", body: JSON.stringify({ serverId: "files" }), headers: { authorization: "Bearer secret", "content-type": "application/json" } })).status).toBe(200)
  expect((await req("/-/registry/files", { method: "DELETE", headers: { authorization: "Bearer secret" } })).status).toBe(204)
})
