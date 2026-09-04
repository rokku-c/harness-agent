/**
 * config/map.ts - DERIVING the new engine's config values.
 *
 * Concept: translate the audited document into MantisConfig - channel
 * (robot vs dws), access credentials, model settings with the legacy
 * reflection.max_passes mapping, approvals from env. Throws only for real
 * errors (robot without credentials); deprecation warnings never throw.
 */
import { envVar } from "../env.ts"
import type { MantisConfig, ModelApi } from "./types.ts"
import type { Toml } from "./discovery.ts"

export const clientIdPresent = (dingtalk: Toml): boolean =>
  typeof dingtalk.client_id === "string" && dingtalk.client_id !== ""

const deriveModel = (agent: Toml): MantisConfig["model"] => {
  const providerType = String(agent.provider_type ?? "openai")
  const api: ModelApi = providerType === "anthropic" ? "anthropic.messages" : "openai.chat"
  const reflection = (agent.reflection ?? {}) as Toml
  return {
    api,
    model: agent.model !== undefined ? String(agent.model) : "gpt-4o-mini",
    apiKey: agent.api_key !== undefined ? String(agent.api_key) : "",
    baseURL: agent.base_url !== undefined ? String(agent.base_url) : undefined,
    maxSteps: agent.max_steps !== undefined ? Number(agent.max_steps) : 1024,
    maxReflections: reflection.max_passes !== undefined ? Number(reflection.max_passes) : 1
  }
}

const deriveAccess = (dingtalk: Toml, channel: "robot" | "dws"): MantisConfig["robot" | "dws"] =>
  channel === "robot"
    ? {
        clientId: String(dingtalk.client_id ?? ""),
        clientSecret: String(dingtalk.client_secret ?? ""),
        agentId: dingtalk.agent_id !== undefined ? String(dingtalk.agent_id) : undefined,
        cardTemplateId: dingtalk.card_template_id !== undefined ? String(dingtalk.card_template_id) : undefined
      }
    : {
        groupId: process.env.DWS_GROUP_ID ?? (typeof dingtalk.group_id === "string" ? dingtalk.group_id : undefined),
        userId: process.env.DWS_USER_ID ?? (typeof dingtalk.user_id === "string" ? dingtalk.user_id : undefined),
        meUserId: process.env.DWS_ME_USER_ID
      }

export const mapToConfig = (cfg: Toml, warnings: string[]): MantisConfig => {
  const agent = (cfg.agent ?? {}) as Toml
  const dingtalk = (cfg.dingtalk ?? {}) as Toml
  const rawChannel = envVar("CHANNEL")
  const channel: "robot" | "dws" =
    rawChannel === "dws" || (rawChannel === undefined && !clientIdPresent(dingtalk)) ? "dws" : "robot"
  if (channel === "robot" && !clientIdPresent(dingtalk))
    throw new Error("[config] robot channel needs [dingtalk] client_id + client_secret in config.toml")
  const protectedTools = (envVar("PROTECTED") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")
  return {
    channel,
    robot: channel === "robot" ? (deriveAccess(dingtalk, channel) as MantisConfig["robot"]) : undefined,
    dws: channel === "dws" ? (deriveAccess(dingtalk, channel) as MantisConfig["dws"]) : undefined,
    model: deriveModel(agent),
    approvals: {
      protectedTools,
      ownerId: envVar("OWNER_ID"),
      ownerGroup: envVar("OWNER_GROUP"),
      timeoutMs: Number(envVar("APPROVE_TIMEOUT_MS") ?? 60_000)
    },
    warnings
  }
}
