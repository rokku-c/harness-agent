import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeConfigRegistry, makeSqliteConfigStore, type StoredConfig } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"
import { openGatewayConfig } from "../src/standalone-config.ts"
import { providers } from "./helpers.ts"

test("invalid old stored schemas fail startup without rewriting or deleting operator data", () => {
  const { id, ...unnamed } = providers[0]
  for (const value of [{ chatBaseURL: "http://old.test" }, { upstreamBase: "http://old.test" }, { providers: [unnamed] }, { port: 4890 }]) {
    const dir = mkdtempSync(join(tmpdir(), "gateway-schema-rejection-"))
    const file = join(dir, "config.sqlite")
    const store = makeSqliteConfigStore({ file })
    const sources = Object.fromEntries(Object.keys(value).map(key => [key, "override" as const]))
    const record: StoredConfig = { value, sources, revision: 7, initialized: true }
    try {
      store.write("ai-gateway", record)
      expect(() => openGatewayConfig({ file })).toThrow()
      expect(store.read("ai-gateway")).toEqual(record)
    } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
  }
})

test("old-field save patches reject atomically and leave valid named providers intact", () => {
  const store = makeSqliteConfigStore({ file: ":memory:" })
  const configs = makeConfigRegistry({ store })
  configs.register(effectConfig)
  try {
    expect(configs.initialize("ai-gateway", { yaml: { providers } }).ok).toBe(true)
    const before = store.read("ai-gateway")
    for (const patch of [{ chatBaseURL: "http://old.test" }, { upstreamBase: "http://old.test" },
      { providers: [providers[0]], apiKey: "old" }]) {
      expect(configs.save("ai-gateway", patch).ok).toBe(false)
      expect(store.read("ai-gateway")).toEqual(before)
    }
  } finally { configs.close(); store.close() }
})
