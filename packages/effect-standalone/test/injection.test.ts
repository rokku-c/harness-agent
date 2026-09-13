import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { startStandaloneStdio } from "../src/index.ts"
import { registryApp } from "./fixtures.ts"

test("the shared MCP registry is injected, as the composition root injects it", async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const hosted = await startStandaloneStdio({ app: registryApp(), transport: serverSide })
  const client = new Client({ name: "registry-probe", version: "0.0.1" })
  try {
    await client.connect(clientSide)
    const call = await client.callTool({ name: "registry_probe", arguments: {} })
    const payload = JSON.parse((call.content as Array<{ text: string }>)[0]!.text) as { injected: boolean }
    // An app whose plugin reads `context.mcpRegistry` loads and answers here; the
    // composition root creates that singleton unconditionally, and so does this host.
    expect(payload.injected).toBe(true)
  } finally {
    await client.close().catch(() => undefined)
    await hosted.stop()
  }
})
