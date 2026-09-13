/**
 * gemini and pi: agents configured by a single settings JSON, with no separate
 * provider block to follow. Both are read here rather than in their own files
 * because the shape - one document, a default model, an optional MCP map - is
 * the same concern; splitting them would duplicate the whole reader.
 */
import { join } from "node:path"
import { fileExists, mcpFactsFrom, readJsonFile, record, text } from "./read.ts"
import type { AgentFacts, AgentKind, ProviderFacts } from "./types.ts"

interface SettingsAgent {
  readonly kind: AgentKind
  /** path of the settings document, relative to home */
  readonly settings: string
  /** document proving credentials exist, when it is not the settings file */
  readonly auth?: string
  readonly read: (settings: Record<string, unknown>) => ProviderFacts
}

const AGENTS: ReadonlyArray<SettingsAgent> = [
  {
    kind: "gemini",
    settings: join(".gemini", "settings.json"),
    read: (settings) => {
      const auth = record(record(settings.security).auth)
      const selected = text(auth.selectedType)
      return {
        credential: selected !== undefined ? "configured" : "unknown",
        ...(selected !== undefined ? { provider: selected } : {})
      }
    }
  },
  {
    kind: "pi",
    settings: join(".pi", "agent", "settings.json"),
    auth: join(".pi", "agent", "auth.json"),
    read: (settings) => ({
      credential: "missing", // corrected below when the auth document exists
      ...(text(settings.defaultProvider) !== undefined
        ? { provider: text(settings.defaultProvider) }
        : {}),
      ...(text(settings.defaultModel) !== undefined ? { model: text(settings.defaultModel) } : {})
    })
  }
]

export const settingsAgentFacts = async (kind: AgentKind, home: string): Promise<Partial<AgentFacts>> => {
  const spec = AGENTS.find((agent) => agent.kind === kind)
  if (spec === undefined) return { mcpServers: [], sources: [], notes: ["no settings reader for " + kind] }
  const path = join(home, spec.settings)
  const settings = await readJsonFile(path)
  if (settings === undefined) {
    return {
      mcpServers: [],
      sources: [],
      notes: [path + " is absent or unreadable; provider and MCP settings are unknown"]
    }
  }
  const provider = spec.read(settings)
  const authPath = spec.auth === undefined ? undefined : join(home, spec.auth)
  const hasAuth = authPath !== undefined && await fileExists(authPath)
  return {
    provider: hasAuth ? { ...provider, credential: "configured" } : provider,
    mcpServers: mcpFactsFrom(settings.mcpServers, "global"),
    sources: [...(hasAuth ? [authPath as string] : []), path]
  }
}
