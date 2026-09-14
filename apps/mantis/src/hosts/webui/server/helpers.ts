import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

export const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })

export const callText = async (client: Client, name: string, args?: Record<string, unknown>): Promise<string> => {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text?: string }> | undefined
  return (content ?? []).map((c) => c.text ?? "").join("")
}

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
