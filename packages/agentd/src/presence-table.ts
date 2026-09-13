/**
 * The lease table behind `presence.ts`: one record per node, and the three
 * transitions a node makes — `announce`, `heartbeat`, `withdraw`.
 *
 * The clock is injected, so expiry can be *asserted* rather than slept through,
 * and the age of a lease is measured on `LeaseClock.monotonic` as well as the
 * wall clock: a backwards NTP step shrinks `now - lastSeen`, which would let a
 * dead node keep looking alive for the length of the step. Taking the larger of
 * the two ages means a lease can never be *extended* by the clock moving
 * backwards. (A forward step does expire leases early, until the next heartbeat
 * — the fail-closed direction, and bounded by the TTL that the step already
 * exceeded.)
 */

import type { LeaseClock, NodePresence, NodePresenceOptions, NodePresenceTable } from "./presence.ts"

interface Held {
  lastSeen: number
  seenAtMono: number
  /** Undefined once the presence has ended (withdrawn), or before one began. */
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

  /**
   * How old a sign of life is. The larger of the two readings on purpose: the
   * monotonic one cannot be walked backwards, so a wall-clock step back can no
   * longer shrink a node's apparent age and keep a dead lease looking fresh.
   */
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
    // A presence that has already lapsed is a *new* presence, not a
    // continuation: "up since" must not quietly include the time it was down.
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
      // Never announced, or said goodbye: this caller has no presence to renew,
      // and treating the nudge as a hello would make the distinction meaningless.
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
