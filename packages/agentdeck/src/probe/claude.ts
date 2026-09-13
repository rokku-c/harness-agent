/**
 * claude code facts. Two files matter: `~/.claude/settings.json` holds the
 * model endpoint and the permission rules, `~/.claude.json` holds MCP servers -
 * globally, and separately per project.
 */
import { join } from "node:path"
import { credentialOf, hostOf, mcpFactsFrom, readJsonFile, record, strings, text } from "./read.ts"
import type { AgentFacts, ProviderFacts } from "./types.ts"

export const claudeFacts = async (home: string, cwd?: string): Promise<Partial<AgentFacts>> => {
  const settingsPath = join(home, ".claude", "settings.json")
  const globalPath = join(home, ".claude.json")
  const settings = await readJsonFile(settingsPath)
  const global = await readJsonFile(globalPath)
  const sources = [
    ...(settings !== undefined ? [settingsPath] : []),
    ...(global !== undefined ? [globalPath] : [])
  ]

  const env = record(settings?.env)
  const baseUrl = text(env.ANTHROPIC_BASE_URL)
  const provider: ProviderFacts = {
    credential: credentialOf(env, ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"]),
    ...(text(env.ANTHROPIC_MODEL) !== undefined ? { model: text(env.ANTHROPIC_MODEL) } : {}),
    ...(baseUrl !== undefined
      ? { provider: "custom-endpoint", baseUrlHost: hostOf(baseUrl) ?? "unparsable-url" }
      : {})
  }

  const permissions = record(settings?.permissions)
  const project = cwd === undefined ? {} : record(record(global?.projects)[cwd])
  return {
    provider,
    mcpServers: [
      ...mcpFactsFrom(global?.mcpServers, "global"),
      ...mcpFactsFrom(project.mcpServers, "project")
    ],
    permissions: {
      allow: [...(strings(permissions.allow) ?? []), ...(strings(project.allowedTools) ?? [])],
      ...(strings(permissions.deny) !== undefined ? { deny: strings(permissions.deny) } : {}),
      ...(text(permissions.defaultMode) !== undefined ? { approval: text(permissions.defaultMode) } : {})
    },
    sources
  }
}
