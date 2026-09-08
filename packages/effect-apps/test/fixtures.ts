import { afterEach } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeConfigRegistry, makeSqliteConfigStore, z } from "@effect-agent/effect-config"
import { buildAppsMcpServer, type AppCatalog, type EffectAppDescriptor } from "../src/index.ts"
import type { EffectUiView } from "@effect-agent/effect-ui"

export const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export const plane = (stop?: () => void | Promise<void>) => ({
  canHandle: () => true,
  handle: async () => new Response("ready"),
  stop,
})

const closeConfigs: Array<() => void> = []
afterEach(() => { for (const close of closeConfigs.splice(0)) close() })

export const appHost = () => {
  const store = makeSqliteConfigStore({ file: ":memory:" })
  const configs = makeConfigRegistry({ store })
  closeConfigs.push(() => { configs.close(); store.close() })
  return {
    host: makePluginHost(),
    registry: makeEffectRegistry(),
    configs,
    uiViews: new Map<string, EffectUiView>(),
    uiHtml: new Map<string, string>(),
  }
}

export const descriptor = (): EffectAppDescriptor => ({
  id: "board",
  config: { appId: "board", schema: z.object({ label: z.string().default("default") }) },
  ui: { viewId: "board", nodes: [] },
  uiHtml: "board",
  tools: [{ name: "echo", handler: (input: unknown) => input }],
})

export const mcpClient = async (catalog: AppCatalog) => {
  const server = buildAppsMcpServer(catalog)
  const client = new Client({ name: "apps-boundary-test", version: "0" })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a)
  await client.connect(b)
  return client
}

export const resultText = (result: unknown): string =>
  (result as { content: Array<{ type: string; text?: string }> }).content
    .filter((item) => item.type === "text").map((item) => item.text).join("")
