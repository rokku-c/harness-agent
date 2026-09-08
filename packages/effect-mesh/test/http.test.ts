import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { handleMeshHttp, makeMesh } from "../src/index.ts"

const call = (handle: (r: Request) => Promise<Response>, method: string, params?: unknown) =>
  handle(new Request("http://mesh/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })).then((r) => r.json())

test("http handle exposes mesh list/discover/call/grant over JSON-RPC", async () => {
  const mesh = makeMesh()
  const reg = makeEffectRegistry()
  reg.registerInterface({
    id: "ops::app-one",
    tools: [{
      name: "echo",
      description: "echo",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => ({ text: (args as { text: string }).text }),
    }],
  })
  mesh.announce({ ns: "ops", appId: "app-one", registry: reg, capabilities: ["echo"] })

  const handle = handleMeshHttp(mesh)
  const listed = await call(handle, "mesh/list") as { result: Array<{ key: string }> }
  expect(listed.result.map((n) => n.key)).toEqual(["ops::app-one"])

  const out = await call(handle, "mesh/call", { ns: "ops", appId: "app-one", tool: "echo", arguments: { text: "via http" } })
  expect((out as { result: { text: string } }).result).toEqual({ text: "via http" })

  const blocked = await call(handle, "mesh/call", { ns: "ops", appId: "app-one", tool: "echo", arguments: {}, byNamespace: "other" }) as { error: { message: string } }
  expect(blocked.error.message).toContain("namespace isolated")

  await call(handle, "mesh/grant", { fromNs: "other", toNs: "ops" })
  const granted = await call(handle, "mesh/call", { ns: "ops", appId: "app-one", tool: "echo", arguments: { text: "granted" }, byNamespace: "other" })
  expect((granted as { result: { text: string } }).result.text).toBe("granted")
})

test("remote announce registers a capability-only node (discoverable)", async () => {
  const mesh = makeMesh()
  const handle = handleMeshHttp(mesh)
  await call(handle, "mesh/announce", { ns: "workspace-b", appId: "board-ui", capabilities: ["ui", "board"] })
  const found = await call(handle, "mesh/discover", { ns: "workspace-b", capability: "ui" }) as { result: Array<{ key: string }> }
  expect(found.result.map((n) => n.key)).toEqual(["workspace-b::board-ui"])
})
