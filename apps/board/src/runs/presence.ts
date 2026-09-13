/**
 * An agent instance is an identity that announced itself and a time it was last
 * heard from. Presence is DERIVED from that timestamp rather than stored: a
 * stored online flag is a claim that goes stale the moment an agent dies, and
 * board would then report a dead agent as connected.
 */
import type { Agent, Announcement } from "./schema.ts"

/** an agent is assumed lost after this long without a heartbeat */
export const ONLINE_WINDOW_MS = 60_000

export const announced = (previous: Agent | undefined, value: Announcement, now: number): Agent => {
  // a heartbeat that omits the host keeps the one already on record
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
