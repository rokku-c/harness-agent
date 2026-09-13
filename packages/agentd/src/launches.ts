/**
 * The launch queue. This is agentd's, not board's: board owns task data, and
 * "run this agent in this directory on that machine" is machine access and
 * scheduling, which is the agentd center's to own.
 *
 * The shape is a pull queue on purpose. A machine behind NAT cannot be called,
 * so an intent waits until the machine it names asks for it, and claiming is
 * what makes an intent a machine's own - after that no other machine is offered
 * it. The center never contacts a node.
 */
import { AgentdError } from "./errors.ts"
import type { LaunchIntent, LaunchRequest, LaunchState } from "./launch-types.ts"

export type { LaunchIntent, LaunchRequest, LaunchState } from "./launch-types.ts"

export interface LaunchQueueOptions {
  readonly now?: () => number
  readonly limitPerPoll?: number
}

const OPEN: readonly LaunchState[] = ["queued", "claimed", "running"]

export const makeLaunchQueue = (options: LaunchQueueOptions = {}) => {
  const now = options.now ?? Date.now
  const limitPerPoll = options.limitPerPoll ?? 1
  const intents = new Map<string, LaunchIntent>()
  const settled = (state: LaunchState): boolean => !OPEN.includes(state)
  return {
    /**
     * A relative workdir means different places on different machines, so the
     * request is refused rather than guessed at: the caller names one directory.
     */
    enqueue: (request: LaunchRequest): LaunchIntent => {
      if (!request.workdir.startsWith("/")) {
        throw new AgentdError(400, `workdir must be an absolute path, got ${request.workdir}`)
      }
      const intent: LaunchIntent = { ...request, intentId: crypto.randomUUID(), state: "queued", createdAt: now() }
      intents.set(intent.intentId, intent)
      return intent
    },
    /**
     * Claim up to `limit` intents for one machine, oldest first. Nothing awaits
     * in here, so two polls cannot both take the same intent.
     */
    poll: (machineId: string, limit: number = limitPerPoll): LaunchIntent[] => {
      const claimed: LaunchIntent[] = []
      for (const intent of intents.values()) {
        if (claimed.length >= limit) break
        if (intent.machineId !== machineId || intent.state !== "queued") continue
        const next: LaunchIntent = { ...intent, state: "claimed", claimedAt: now() }
        intents.set(next.intentId, next)
        claimed.push(next)
      }
      return claimed
    },
    /** A machine reporting on an intent it holds; no other machine may. */
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
    /**
     * What has been asked, optionally of one machine or for one task node. Both
     * are lookups a caller arrives with, not searches: an agent picking up a task
     * asks what was tried on it, and a caller asking about a machine asks for a
     * machine it can name.
     */
    list: (query: { readonly machineId?: string; readonly nodeId?: string } = {}): LaunchIntent[] =>
      [...intents.values()].filter((intent) =>
        (query.machineId === undefined || intent.machineId === query.machineId)
        && (query.nodeId === undefined || intent.nodeId === query.nodeId)),
    /** An intent still waiting on a machine, so one node is never asked twice at once. */
    openOn: (nodeId: string): LaunchIntent | undefined => [...intents.values()].find((intent) => intent.nodeId === nodeId && OPEN.includes(intent.state)),
  }
}
export type LaunchQueue = ReturnType<typeof makeLaunchQueue>
