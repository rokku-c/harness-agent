import { beforeEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { startStandaloneStdio } from "../src/index.ts"
import { record, soloApp } from "./fixtures.ts"

beforeEach(() => { record.stops.length = 0 })

test("the same single app is hostable on stdio, opening no port", async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const hosted = await startStandaloneStdio({ app: soloApp(), transport: serverSide })
  const client = new Client({ name: "stdio-client", version: "0.0.1" })
  try {
    expect(hosted.surface).toEqual(["mcp:stdio"])
    await client.connect(clientSide)
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["solo_read"])

    const call = await client.callTool({ name: "solo_read", arguments: {} })
    expect(call.isError).not.toBe(true)
    expect(JSON.parse((call.content as Array<{ text: string }>)[0]!.text)).toEqual({ label: "solo" })
  } finally {
    await client.close().catch(() => undefined)
    await hosted.stop()
  }
  expect(record.stops).toEqual(["solo"])
})
