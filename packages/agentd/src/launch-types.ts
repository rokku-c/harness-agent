/**
 * The launch protocol: what the center asks a machine to run, and what becomes
 * of it. Kept apart from the queue that stores these, because the machine
 * package speaks this shape over the wire and should not have to depend on the
 * center's queue to name it.
 */

export type LaunchState = "queued" | "claimed" | "running" | "done" | "failed" | "cancelled"

export interface LaunchRequest {
  /** The board task node this work belongs to, if any. Opaque here. */
  readonly nodeId: string
  /** The machine that should carry it out. */
  readonly machineId: string
  /** Which agent to run, in the machine's own vocabulary. */
  readonly kind: string
  readonly workdir: string
  readonly prompt: string
  /**
   * An explicit command and its arguments, for work that is not an agent turn —
   * installing an agent, for instance. Naming one is also how a caller asks for
   * a kind no dialect table has heard of; the machine runs what it was given
   * rather than guessing which agent was meant.
   */
  readonly command?: string
  readonly args?: readonly string[]
}

export interface LaunchIntent extends LaunchRequest {
  readonly intentId: string
  readonly state: LaunchState
  readonly createdAt: number
  readonly claimedAt?: number
  readonly settledAt?: number
  /** What the machine said when it finished or gave up. */
  readonly detail?: string
}
