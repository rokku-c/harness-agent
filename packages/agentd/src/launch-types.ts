/**
 * The launch protocol: what the center asks a machine to run, and what becomes
 * of it. Kept apart from the queue that stores these, because the machine
 * package speaks this shape over the wire and should not have to depend on the
 * center's queue to name it.
 *
 * Work is one of two things, and the difference is *who the machine is* when it
 * runs. A **turn** runs as an identity: the identity names the machine, the CLI
 * dialect to spawn and the credential the door will verify, so a caller names
 * the identity and nothing derived from it. A **command** runs as itself and has
 * no identity at all. A caller allowed to name an identity *and* a dialect is
 * the shape where the config the center planned and the process that started
 * agree only by luck.
 */

export type LaunchState = "queued" | "claimed" | "running" | "done" | "failed" | "cancelled"

/** Work done as an identity (§F10): the agent's turn. */
export interface AgentTurn {
  /**
   * The task node this work is filed under, when the caller has one. Opaque here:
   * the center stores it and never reads it, because what a turn runs as and
   * where it runs are functions of its identity alone. Absent is a turn asked for
   * by hand, which belongs to no node — a different state from one whose node is
   * unknown, which is why it is absent rather than empty.
   */
  readonly nodeId?: string
  /**
   * The identity the turn runs as — a principal key, because that is the key the
   * door resolves a credential to and binds sets by.
   */
  readonly agentId: string
  readonly workdir: string
  readonly prompt: string
}

/**
 * Work that is not an agent turn — installing an agent, for instance. The
 * machine runs what it was given rather than guessing which agent was meant,
 * which is also how a caller asks for a kind no dialect table has heard of.
 *
 * It names the machine and nothing else about where it goes: a launch used to
 * carry a `nodeId` beside the `machineId` for this arm, which was one machine
 * written twice — the center keys its machines by one id, the deployment plane
 * spells that same id `nodeId`, and a caller supplying both could state two
 * machines in one request and have the queue file it under the one the machine
 * does not run on.
 */
export interface CommandWork {
  readonly machineId: string
  readonly workdir: string
  readonly command: string
  readonly args?: readonly string[]
}

/**
 * A turn as the center queued it: the identity, plus the machine and dialect
 * that identity resolved to *at the moment of queueing*. Read off the fleet
 * rather than restated by the caller — and carried here because the machine acts
 * on it, so re-resolving on the far side would be a second read that can
 * disagree with the one the intent was recorded from.
 */
export interface QueuedTurn extends AgentTurn {
  readonly machineId: string
  readonly kind: string
}

export type QueuedWork = QueuedTurn | CommandWork

/** One piece of work, and what has become of it. */
export type LaunchIntent = QueuedWork & {
  readonly intentId: string
  readonly state: LaunchState
  readonly createdAt: number
  readonly claimedAt?: number
  readonly settledAt?: number
  /** What the machine said when it finished or gave up. */
  readonly detail?: string
}
