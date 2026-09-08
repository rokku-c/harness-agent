import { expect, test } from "bun:test"
import { makeRegistry, type McpServer } from "../src/index.ts"
const T = 1_000_000
const board: McpServer = { serverId: "effect-board", name: "board", version: "1", era: "modern", transport: { kind: "stdio" }, capabilities: { apps: 1 } }
const registry = () => makeRegistry({ now: () => T, auth: { authorize: (token) => token === "secret" } })
const legacyShim: McpServer = { serverId: "legacy-shim", name: "legacy", version: "1", era: "legacy", transport: { kind: "stdio" } }

test("choose routes to the modern healthy server first", () => {
  const reg = registry()
  reg.announce(legacyShim, "secret")
  reg.announce(board, "secret")

  expect(reg.choose()?.serverId).toBe("effect-board")

  // Dropping the modern server to offline falls through to the shim.
  reg.touch("effect-board", 0)
  expect(reg.choose()?.serverId).toBe("legacy-shim")

  // Offline-only registry resolves to nothing.
  reg.touch("legacy-shim", 0)
  expect(reg.choose()).toBeUndefined()
})

test("choose honours serverId and appsOnly filters", () => {
  const reg = registry()
  const bare: McpServer = {
    ...board,
    serverId: "bare",
    capabilities: { tools: 3 },
    apps: undefined,
  }
  reg.register(bare)
  reg.register(board)

  expect(reg.choose({ serverId: "bare" })?.serverId).toBe("bare")
  expect(reg.choose({ era: "legacy" })).toBeUndefined()
  expect(reg.choose({ appsOnly: true })?.serverId).toBe("effect-board")
})

test("re-registering keeps an existing heartbeat", () => {
  const reg = registry()
  reg.register(board)
  reg.touch("effect-board", T - 1_000)
  reg.register({ ...board, version: "v0.13.1" })

  const record = reg.get("effect-board", T)
  expect(record?.version).toBe("v0.13.1")
  expect(record?.status).toBe("healthy")
})
