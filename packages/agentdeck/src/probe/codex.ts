/**
 * codex CLI facts, from `~/.codex/config.toml`. The active provider is named by
 * `model_provider` and defined in `[model_providers.<name>]`, so the endpoint is
 * only knowable by following that indirection.
 */
import { join } from "node:path"
import { fileExists, hostOf, mcpFactsFrom, readTomlFile, record, text } from "./read.ts"
import type { AgentFacts, CredentialState, ProviderFacts } from "./types.ts"

export const codexFacts = async (home: string): Promise<Partial<AgentFacts>> => {
  const configPath = join(home, ".codex", "config.toml")
  const authPath = join(home, ".codex", "auth.json")
  const config = await readTomlFile(configPath)
  const hasAuth = await fileExists(authPath)
  const sources = [...(config !== undefined ? [configPath] : []), ...(hasAuth ? [authPath] : [])]

  const providerName = text(config?.model_provider)
  const active = record(providerName !== undefined ? record(config?.model_providers)[providerName] : undefined)
  const baseUrl = text(active.base_url)
  const needsAuth = active.requires_openai_auth === true
  const credential: CredentialState = needsAuth || hasAuth
    ? "configured"
    : providerName === undefined ? "unknown" : "missing"

  const provider: ProviderFacts = {
    credential,
    ...(text(active.name) !== undefined || providerName !== undefined
      ? { provider: text(active.name) ?? providerName }
      : {}),
    ...(text(config?.model) !== undefined ? { model: text(config?.model) } : {}),
    ...(baseUrl !== undefined ? { baseUrlHost: hostOf(baseUrl) ?? "unparsable-url" } : {})
  }

  return {
    provider,
    mcpServers: mcpFactsFrom(config?.mcp_servers, "global"),
    permissions: {
      ...(text(config?.approval_policy) !== undefined
        ? { approval: text(config?.approval_policy) }
        : text(config?.approvals_reviewer) !== undefined
          ? { approval: text(config?.approvals_reviewer) }
          : {}),
      ...(text(config?.sandbox_mode) !== undefined ? { sandbox: text(config?.sandbox_mode) } : {})
    },
    sources
  }
}
