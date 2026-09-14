import type { LeaseClock, NodePresence, NodePresenceOptions, NodePresenceTable } from "./presence.ts"

interface Held {
  lastSeen: number
  seenAtMono: number
  presentSince?: number
  withdrawn: boolean
}

export const makeNodePresence = (options: NodePresenceOptions = {}): NodePresenceTable => {
  const clock: LeaseClock = {
    now: options.clock?.now ?? Date.now,
    monotonic: options.clock?.monotonic ?? (() => performance.now()),
  }
  const ttlMs = options.leaseTtlMs ?? 30_000
  const held = new Map<string, Held>()

  const ageOf = (lease: Held): number =>
    Math.max(0, clock.now() - lease.lastSeen, clock.monotonic() - lease.seenAtMono)

  const lapsed = (lease: Held): boolean => lease.withdrawn || ageOf(lease) >= ttlMs

  const view = (nodeId: string, lease: Held): NodePresence => {
    const ageMs = ageOf(lease)
    return {
      nodeId,
      online: !lease.withdrawn && ageMs < ttlMs,
      lastSeen: lease.lastSeen,
      ageMs,
      withdrawn: lease.withdrawn,
      ...(lease.presentSince === undefined ? {} : { presentSince: lease.presentSince }),
    }
  }

  const start = (nodeId: string): NodePresence => {
    const existing = held.get(nodeId)
    const now = clock.now()
    const lease: Held = {
      lastSeen: now,
      seenAtMono: clock.monotonic(),
      withdrawn: false,
      presentSince: existing === undefined || lapsed(existing) ? now : (existing.presentSince ?? now),
    }
    held.set(nodeId, lease)
    return view(nodeId, lease)
  }

  return {
    announce: start,
    heartbeat: (nodeId) => {
      const existing = held.get(nodeId)
      if (existing === undefined || existing.withdrawn) return undefined
      return start(nodeId)
    },
    withdraw: (nodeId) => {
      const existing = held.get(nodeId)
      if (existing === undefined) return undefined
      const lease: Held = { ...existing, withdrawn: true, presentSince: undefined }
      held.set(nodeId, lease)
      return view(nodeId, lease)
    },
    presence: (nodeId) => {
      const lease = held.get(nodeId)
      return lease === undefined ? undefined : view(nodeId, lease)
    },
    list: () => [...held.entries()].map(([nodeId, lease]) => view(nodeId, lease)),
  }
}
