/**
 * Node presence — registration, heartbeat and lease, for §8.5-1 of
 * docs/architecture-rework.md ("节点注册 / 心跳 / 租约").
 *
 * The gap this closes is narrow and specific: **a node's being up is a fact the
 * server observes, not a field a node writes.** agentd's `Machine` carries a
 * `status`, but nothing ever computes it — whoever registered the record chose
 * the word, and a machine that died mid-heartbeat keeps claiming `"online"`
 * forever. So presence lives here, beside the machine but not inside it, and it
 * is derived on read: `online` is "renewed within `leaseTtlMs`", full stop.
 *
 * The form is mcp-registry's `announce` / `heartbeat` / `withdraw` lease
 * (`packages/mcp-registry/src/store.ts`), which is the repo's only working
 * liveness mechanism. It is *reused, not imported*: a registry entry is shaped
 * like an MCP server (transport, era, tool counts) and its status ladder
 * (`healthy | warn | offline`) answers "is this a good server to choose",
 * which is a different question from "does this node exist right now". Sharing
 * the type would mean a node wearing a server's identity to borrow four lines.
 * What is shared is the mechanism, and one deliberate divergence:
 *
 *   - mcp-registry's `static` leases never expire, because servers registered
 *     from code are always "there". A node has no static form — being in a
 *     config file is not being up (see `nodes.test.ts`: a seeded machine is
 *     offline until it announces). There is one lease here, and it ages.
 *
 * Two things the shape buys that are load-bearing rather than decorative:
 *
 *   1. **The clock is injected.** Expiry can be *asserted* rather than slept
 *      through, and the age of a lease is measured on {@link LeaseClock.monotonic}
 *      as well as the wall clock: a backwards NTP step shrinks `now - lastSeen`,
 *      which would let a dead node keep looking alive for the length of the step.
 *      Taking the larger of the two ages means a lease can never be *extended*
 *      by the clock moving backwards. (A forward step does expire leases early,
 *      until the next heartbeat — the fail-closed direction, and bounded by the
 *      TTL that the step already exceeded.)
 *   2. **Expiry is not deletion.** An offline node keeps its machine record and
 *      its deployment: the desired set is what it will be handed when it comes
 *      back (§8.4), so throwing it away on a missed heartbeat would destroy the
 *      very thing the pull model recovers from. See `desiredNode`.
 */

import { timingSafeEqual } from "node:crypto"

/**
 * Wall clock plus an elapsed-time reading that only moves forward.
 *
 * The monotonic side is not a second wall clock for display: it is the only
 * thing age may be measured with. `performance.now()` counts from process start,
 * which is exactly the lifetime of the table below — a process-lifetime lease
 * table gets a process-lifetime clock, so the two cannot disagree about how much
 * time has passed.
 */
export interface LeaseClock {
  /** Stamped on `lastSeen` / `presentSince` — the readings a human compares to a log. */
  now(): number
  monotonic(): number
}

/** What the server currently believes about one node. Derived, never stored. */
export interface NodePresence {
  readonly nodeId: string
  /** Renewed within `leaseTtlMs`, and not withdrawn. The whole point of this file. */
  readonly online: boolean
  /** Wall clock of the last sign of life. Absent = this node has never announced. */
  readonly lastSeen?: number
  /** Wall clock the *current* uninterrupted presence began. Absent = not present. */
  readonly presentSince?: number
  /** Age of the last sign of life, in ms. Absent = never announced. */
  readonly ageMs?: number
  /**
   * The node said goodbye, rather than stopped saying hello. Worth separating:
   * a clean shutdown is a deploy, a lapsed lease is an incident.
   */
  readonly withdrawn: boolean
}

export interface NodePresenceOptions {
  /**
   * How long one sign of life is good for. 30s by default: nodes are processes
   * that heartbeat on the order of seconds, and a lease shorter than the
   * heartbeat interval would report every healthy node as offline in turn.
   */
  readonly leaseTtlMs?: number
  /** Both halves are injectable so a test can age a lease instead of sleeping. */
  readonly clock?: Partial<LeaseClock>
}

export interface NodePresenceTable {
  /** Start a presence, or renew one that is still alive. */
  announce(nodeId: string): NodePresence
  /**
   * Renew a presence that is still alive, or start a new one if the last lapsed.
   * `undefined` when this node never announced or has withdrawn — a node coming
   * back from either is saying hello again, which is {@link announce}.
   */
  heartbeat(nodeId: string): NodePresence | undefined
  /** End a presence. The node still exists; it is simply not running. */
  withdraw(nodeId: string): NodePresence | undefined
  presence(nodeId: string): NodePresence | undefined
  list(): readonly NodePresence[]
}

interface Held {
  lastSeen: number
  seenAtMono: number
  /** Undefined once the presence has ended (withdrawn), or before one began. */
  presentSince?: number
  withdrawn: boolean
}

/** Constant-time comparison, so a wrong token cannot be narrowed by timing. */
export const sameToken = (left: string, right: string): boolean => {
  const a = Buffer.from(left), b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
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
