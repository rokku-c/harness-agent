import { afterAll, expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeMesh } from "../src/index.ts"

let listener: ReturnType<typeof Bun.serve>
let last: string | undefined

listener = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch: async (request) => {
    last = await request.text()
    return Response.json({ ok: true })
  },
})

afterAll(() => listener.stop())

test("host pushes a ui/event payload to a remote node's eventsUrl", async () => {
  const mesh = makeMesh()
  mesh.announce({
    ns: "workspace-b",
    appId: "board-ui",
    registry: makeEffectRegistry(),
    capabilities: ["ui"],
    eventsUrl: "http://127.0.0.1:" + listener.port,
  })

  await mesh.push({ ns: "workspace-b", appId: "board-ui" }, { kind: "ui/spec", spec: "v2", by: "ops" })

  expect(last).toContain("mesh/push")
  expect(last).toContain('"spec":"v2"')

  await expect(
    mesh.push({ ns: "workspace-b", appId: "unknown" }, { kind: "ui/spec" }),
  ).rejects.toThrow("no push target")
})
