import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"
import { startStandaloneAiGateway } from "../src/standalone.ts"
import { openGatewayConfig } from "../src/standalone-config.ts"
import { paths, providers, stubFetch } from "./helpers.ts"

test("standalone uses persisted providers and hot-reads SQLite changes without env or URL fallback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gateway-config-"))
  const file = join(dir, "config.sqlite")
  const store = makeSqliteConfigStore({ file })
  const configs = makeConfigRegistry({ store })
  configs.register(effectConfig)
  configs.initialize("ai-gateway", { yaml: { providers: [providers[0]] } })
  const stub = stubFetch()
  const server = startStandaloneAiGateway({ file, port: 0, send: stub.send, recorder: { record: () => undefined } })
  const call = () => fetch(new URL(paths[0], server.url), { method: "POST", body: '{"stream":true}' })
  try {
    expect((await call()).status).toBe(200)
    expect(stub.requests[0].url).toBe("https://chat.example.test/proxy/v1/chat/completions")
    expect(configs.save("ai-gateway", { providers: [{ ...providers[0], baseURL: "https://saved.test/v1" }] }).ok).toBe(true)
    expect((await call()).status).toBe(200)
    expect(stub.requests[1].url).toBe("https://saved.test/v1/chat/completions")
    expect(configs.save("ai-gateway", { providers: [] }).ok).toBe(true)
    expect((await call()).status).toBe(503)
    const old = store.read("ai-gateway")!
    store.write("ai-gateway", { ...old, value: { providers: [providers[0], providers[0]] }, sources: { providers: "override" } })
    const failed = await call()
    expect(failed.status).toBe(503)
    expect(await failed.json()).toMatchObject({ error: { type: "config_error" } })
    expect(stub.requests.length).toBe(2)
  } finally { await server.stop(true); configs.close(); store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test("unconfigured SQLite initializes empty and invalid persisted providers stop startup", () => {
  const empty = openGatewayConfig({ file: ":memory:" })
  try { expect(empty.getConfig()).toEqual({}) } finally { empty.close() }
  const dir = mkdtempSync(join(tmpdir(), "gateway-invalid-"))
  const file = join(dir, "config.sqlite")
  const store = makeSqliteConfigStore({ file })
  store.write("ai-gateway", { value: { providers: [providers[0], providers[0]] }, sources: { providers: "override" }, revision: 1, initialized: true })
  store.close()
  try { expect(() => openGatewayConfig({ file })).toThrow("operator must rebuild") }
  finally { rmSync(dir, { recursive: true, force: true }) }
})
