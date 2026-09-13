import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { noopLogger } from "@effect-agent/logger"
import { effectConfig } from "./effect-config.ts"
import { WebConsole } from "./hosts/webui/console.ts"
import { makeConsoleHandler } from "./hosts/webui/server/handler.ts"
import { makeMantisMcp } from "./hosts/mcp/mcp.ts"
import { embeddedModel } from "./hosts/webui/embedded-model.ts"

const publicDir = fileURLToPath(new URL("./hosts/webui/public", import.meta.url))
type Config = ReturnType<typeof effectConfig.schema.parse>

export const createMantisPlugin = (getConfig: () => unknown) => ({
  id: "mantis",
  priority: 30,
  load: async () => {
    const config: Config = effectConfig.schema.parse(getConfig())
    const web = new WebConsole({
      model: embeddedModel(config.model),
      maxSteps: config.model.maxSteps,
      maxReflections: config.model.maxReflections,
      protectedTools: config.protectedTools,
      approveTimeoutMs: config.approveTimeoutMs,
      workspaceFile: config.workspaceDir + "/workspace.sqlite",
      logger: noopLogger(),
    })
    const mcp = makeMantisMcp({ console: web })
    const client = new Client({ name: "mantis-embedded-console", version: "0.1.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await mcp.connect(pair[0])
    await client.connect(pair[1])
    const handle = makeConsoleHandler({ client, publicDir, basePath: "/mantis" })
    return {
      handle,
      stop: async () => { await client.close(); await mcp.close() },
    }
  },
})
