/**
 * server/helpers.ts - SHARED HTTP TRANSLATOR HELPERS.
 *
 * Concept: the web panel's browser cannot speak MCP (stdio), so every /api
 * call maps onto the mantis MCP server (in-process client). These helpers
 * shape one MCP tool call into an HTTP response (concatenated text content,
 * JSON body, asset reads).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

export const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })

export const readAsset = (dir: string, name: string): string | undefined => {
  try {
    return readFileSync(join(dir, name), "utf-8")
  } catch {
    return undefined
  }
}

/** one MCP tool call -> the concatenated text content */
export const callText = async (client: Client, name: string, args?: Record<string, unknown>): Promise<string> => {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text?: string }> | undefined
  return (content ?? []).map((c) => c.text ?? "").join("")
}

/** split a newline-delimited JSON tool answer into parsed objects (skips bad lines) */
export const parseJsonLines = <T>(text: string): T[] => {
  if (text === "(none)" || text === "") return []
  const entries: T[] = []
  for (const line of text.split("\n")) {
    if (line === "") continue
    try {
      entries.push(JSON.parse(line) as T)
    } catch {
      // skip malformed line
    }
  }
  return entries
}
