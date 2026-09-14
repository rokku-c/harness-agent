import type { Agent, Announcement } from "./schema.ts"

export const ONLINE_WINDOW_MS = 60_000

export const announced = (previous: Agent | undefined, value: Announcement, now: number): Agent => {
  const host = value.host ?? previous?.host
  return {
    agentId: value.agentId, kind: value.kind, channel: value.channel,
    ...(host !== undefined ? { host } : {}),
    capabilities: value.capabilities, firstSeen: previous?.firstSeen ?? now, lastSeen: now,
  }
}
export const presenceOf = (agent: Agent, now: number): "online" | "offline" =>
  now - agent.lastSeen <= ONLINE_WINDOW_MS ? "online" : "offline"
export const withPresence = (agents: readonly Agent[], now: number): (Agent & { presence: "online" | "offline" })[] =>
  agents.map((agent) => ({ ...agent, presence: presenceOf(agent, now) }))
