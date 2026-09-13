/**
 * Node presence — what the server believes about whether a node is up, for
 * §8.5-1 of docs/architecture-rework.md ("节点注册 / 心跳 / 租约").
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
 * What is shared is the mechanism, and it lives in `presence-table.ts` — with
 * one deliberate divergence from it: there is no `static` lease. Servers
 * registered from code are always "there"; a node has no static form, because
 * being in a config file is not being up (see `nodes.test.ts`: a seeded machine
 * is offline until it announces). There is one lease here, and it ages.
 *
 * Expiry is not deletion: an offline node keeps its machine record and its
 * deployment, because the desired set is what it will be handed when it comes
 * back (§8.4) — discarding it on a missed heartbeat would destroy the very thing
 * the pull model recovers from. See `desiredNode`.
 */

/**
 * Wall clock plus an elapsed-time reading that only moves forward.
 *
 * The monotonic side is not a second wall clock for display: it is the only
 * thing age may be measured with. `performance.now()` counts from process start,
 * which is exactly the lifetime of the lease table — a process-lifetime lease
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
