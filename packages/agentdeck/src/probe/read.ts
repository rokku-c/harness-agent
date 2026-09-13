/** reading config files, and reducing them so no secret survives the read. */
import { readFile } from "node:fs/promises"
import { parse as parseToml } from "smol-toml"
import type { CredentialState, McpServerFacts } from "./types.ts"

export const record = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>

export const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const strings = (value: unknown): ReadonlyArray<string> | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined

export const readJsonFile = async (path: string): Promise<Record<string, unknown> | undefined> => {
  const raw = await readFile(path, "utf-8").catch(() => undefined)
  if (raw === undefined) return undefined
  try { return record(JSON.parse(raw)) } catch { return undefined }
}

export const readTomlFile = async (path: string): Promise<Record<string, unknown> | undefined> => {
  const raw = await readFile(path, "utf-8").catch(() => undefined)
  if (raw === undefined) return undefined
  try { return record(parseToml(raw)) } catch { return undefined }
}

export const fileExists = async (path: string): Promise<boolean> =>
  await readFile(path).then(() => true).catch(() => false)

/** HOST ONLY. A configured endpoint may embed credentials in its userinfo, and
 *  a probe result travels to a control plane. */
export const hostOf = (url: string): string | undefined => {
  try { return new URL(url).host } catch { return undefined }
}

/** presence, never value */
export const credentialOf = (env: Record<string, unknown>, keys: ReadonlyArray<string>): CredentialState => {
  for (const key of keys) if (text(env[key]) !== undefined) return "configured"
  return "missing"
}

/** one MCP server entry in any of the dialects we have seen, normalized */
export const mcpFacts = (
  name: string,
  raw: unknown,
  scope: McpServerFacts["scope"]
): McpServerFacts => {
  const entry = record(raw)
  const url = text(entry.url)
  const command = text(entry.command)
  const declared = text(entry.type) ?? text(entry.transport)
  const transport: McpServerFacts["transport"] = url !== undefined
    ? (declared === "sse" ? "sse" : "http")
    : command !== undefined ? "stdio" : "unknown"
  return {
    name,
    transport,
    ...(url !== undefined ? { target: hostOf(url) ?? "unparsable-url" } : {}),
    ...(url === undefined && command !== undefined ? { target: command } : {}),
    scope
  }
}

export const mcpFactsFrom = (
  value: unknown,
  scope: McpServerFacts["scope"]
): ReadonlyArray<McpServerFacts> => {
  const servers = record(value)
  return Object.keys(servers).sort().map((name) => mcpFacts(name, servers[name], scope))
}
