import { afterAll, expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { handleMeshHttp, makeMesh, makeMeshClient } from "../src/index.ts"

let home: ReturnType<typeof Bun.serve>
let remote: ReturnType<typeof Bun.serve>
const homeMesh = makeMesh()
const remoteMesh = makeMesh()

const remoteRegistry = makeEffectRegistry()
remoteRegistry.registerInterface({
  id: "zone-r::clock",
  tools: [{
    name: "now",
    description: "current unix ms",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ now: String(Date.now()).length > 0 ? "ticking" : "ticking" }),
  }],
})

remoteMesh.announce({ ns: "zone-r", appId: "clock", registry: remoteRegistry, capabilities: ["clock"] })

home = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handleMeshHttp(homeMesh) })
remote = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handleMeshHttp(remoteMesh) })

afterAll(() => {
  home.stop()
  remote.stop()
})

test("a remote node announces back into a home and the home calls it through the endpoint", async () => {
  const client = makeMeshClient({ url: "http://127.0.0.1:" + home.port })
  await client.announce({
    ns: "zone-r",
    appId: "clock",
    capabilities: ["clock"],
    endpointUrl: "http://127.0.0.1:" + remote.port,
  })

  const found = await client.discover("zone-r", "clock") as Array<{ key: string }>
  expect(found.map((n) => n.key)).toEqual(["zone-r::clock"])

  // home -> (announced node has an endpoint) -> proxy to remote mesh -> local tool
  const result = await homeMesh.call({ ns: "zone-r", appId: "clock", tool: "now" }, {})
  expect(result).toEqual({ now: "ticking" })

  // and a peer client can reach it too (same namespace)
  const viaClient = await client.call({ ns: "zone-r", appId: "clock", tool: "now" }, {})
  expect(viaClient).toEqual({ now: "ticking" })
})
