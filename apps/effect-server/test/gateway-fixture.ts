import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

export const gatewayFixture = async () => {
  const dir = mkdtempSync(join(tmpdir(), "effect-config-integration-"))
  const received: Array<{ path: string; auth: string | null; key: string | null }> = []
  const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
    await req.text()
    const path = new URL(req.url).pathname
    received.push({ path, auth: req.headers.get("authorization"), key: req.headers.get("x-api-key") })
    return Response.json({ path })
  } })
  const baseURL = upstream.url.origin + "/first/v1"
  const appDir = join(dir, "apps", "ai-gateway")
  mkdirSync(appDir, { recursive: true })
  writeFileSync(join(appDir, "effect.yaml"), JSON.stringify({ id: "ai-gateway", transport: "inproc",
    module: resolve(import.meta.dir, "../../ai-gateway/src/effect-app.ts"),
    config: { providers: [{ id: "chat-primary", apiType: "openai.chat", baseURL, apiKey: "test-key" }] },
  }))
  const yaml = join(dir, "effect.yaml"), configFile = join(dir, "config.sqlite")
  writeFileSync(yaml, JSON.stringify({ roots: ["apps"], enabled: ["ai-gateway", "console", "config", "effect-apps", "monitor"] }))
  const boot = () => startEffectServerYaml(yaml, { configFile })
  let app = await boot()
  const request = (path: string, body?: unknown) => app.host.handle(new Request(`http://home${path}`, body === undefined ? {} : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }))
  return { dir, upstream, received, request, configFile,
    handle: (request: Request) => app.host.handle(request),
    active: () => app.configRuntime.active("ai-gateway"),
    restart: async () => { await app.stop(); app = await boot() },
    close: async () => { await app.stop(); upstream.stop(true); rmSync(dir, { recursive: true, force: true }) },
  }
}
export const chat = { model: "stub", messages: [{ role: "user", content: "hello" }] }
