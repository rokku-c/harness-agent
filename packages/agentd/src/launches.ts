import { AgentdError } from "./errors.ts"
import { claimLapsed, settled } from "./launch-claim.ts"
import type { LaunchIntent, LaunchState, QueuedWork } from "./launch-types.ts"

export type { AgentTurn, CommandWork, LaunchIntent, LaunchState, QueuedTurn, QueuedWork } from "./launch-types.ts"

export interface LaunchQueueOptions {
  readonly now?: () => number
  readonly limitPerPoll?: number
  readonly claimTtlMs?: number
}

export const makeLaunchQueue = (options: LaunchQueueOptions = {}) => {
  const now = options.now ?? Date.now
  const limitPerPoll = options.limitPerPoll ?? 1
  const claimTtlMs = options.claimTtlMs ?? 300_000
  const intents = new Map<string, LaunchIntent>()
  return {
    enqueue: (work: QueuedWork): LaunchIntent => {
      if (!work.workdir.startsWith("/")) {
        throw new AgentdError(400, `workdir must be an absolute path, got ${work.workdir}`)
      }
      const intent: LaunchIntent = { ...work, intentId: crypto.randomUUID(), state: "queued", createdAt: now() }
      intents.set(intent.intentId, intent)
      return intent
    },
    poll: (machineId: string, limit: number = limitPerPoll): LaunchIntent[] => {
      const at = now()
      const claimed: LaunchIntent[] = []
      for (const intent of intents.values()) {
        if (claimed.length >= limit) break
        if (intent.machineId !== machineId) continue
        if (intent.state !== "queued" && !claimLapsed(intent, at, claimTtlMs)) continue
        const next: LaunchIntent = { ...intent, state: "claimed", claimedAt: at }
        intents.set(next.intentId, next)
        claimed.push(next)
      }
      return claimed
    },
    report: (intentId: string, machineId: string, state: LaunchState, detail?: string): LaunchIntent => {
      const intent = intents.get(intentId)
      if (intent === undefined) throw new AgentdError(404, `Unknown launch intent: ${intentId}`)
      if (intent.machineId !== machineId) {
        throw new AgentdError(409, `Launch ${intentId} belongs to ${intent.machineId}, not ${machineId}`)
      }
      if (settled(intent.state)) throw new AgentdError(409, `Launch ${intentId} already settled as ${intent.state}`)
      const next: LaunchIntent = {
        ...intent, state,
        ...(detail === undefined ? {} : { detail }),
        ...(settled(state) ? { settledAt: now() } : {}),
      }
      intents.set(next.intentId, next)
      return next
    },
    get: (intentId: string): LaunchIntent | undefined => intents.get(intentId),
    list: (query: { readonly machineId?: string; readonly nodeId?: string } = {}): LaunchIntent[] =>
      [...intents.values()].filter((intent) =>
        (query.machineId === undefined || intent.machineId === query.machineId)
        && (query.nodeId === undefined || ("nodeId" in intent && intent.nodeId === query.nodeId))),
  }
}
export type LaunchQueue = ReturnType<typeof makeLaunchQueue>
