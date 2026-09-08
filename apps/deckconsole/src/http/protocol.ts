import type { DeckDomain } from "../domain/deck.ts"

export type Controller = (request: Request, url: URL, domain: DeckDomain) => Promise<Response | undefined>
export const json = (value: unknown, status = 200) => Response.json(value, { status })
export const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  const text = await request.text()
  const body: unknown = text === "" ? {} : JSON.parse(text)
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object")
  return body as Record<string, unknown>
}
export const param = (path: string, pattern: string): string | undefined => {
  const parts = path.split("/").filter(Boolean), tokens = pattern.split("/").filter(Boolean)
  if (parts.length !== tokens.length) return
  let captured: string | undefined
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith(":")) captured = decodeURIComponent(parts[i])
    else if (tokens[i] !== parts[i]) return
  }
  return captured
}
