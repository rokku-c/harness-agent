/**
 * agentdeck/discover - reading agent sessions that ALREADY exist on a machine.
 *
 * The gateway layer answers "drive a session I opened". This layer answers the
 * other question: "what sessions are on this disk, from any agent, right now".
 * Every adapter is read-only and defensive: a missing directory, an unreadable
 * file or a foreign format yields fewer sessions, never an error - the caller
 * is enumerating a machine it does not own.
 */
import type { AgentKind } from "../kinds.ts"

/** One agent session found on disk: the facts, and for the newest few, the tail of the transcript. */
export interface DiscoveredSession {
  readonly kind: AgentKind
  /** the agent's own session id where it has one, else a stable path-derived id */
  readonly sessionId: string
  /** working directory the session was started in, when the store records it */
  readonly cwd?: string
  /** first human-meaningful line, for a list view */
  readonly title?: string
  readonly startedAt: number
  readonly updatedAt: number
  readonly bytes: number
  /** absolute path of the record this came from */
  readonly source: string
  /**
   * The end of the transcript, for the sessions a caller asked about. Absent for
   * most of them: an index of hundreds of sessions ships the tails of the newest
   * few, because that is the one an agent comes back to read.
   */
  readonly tail?: string
}

export interface DiscoverOptions {
  /** home directory to scan; defaults to the process user's home */
  readonly home?: string
  /** cap per kind, newest first */
  readonly limit?: number
  /** restrict to these kinds; every discovery-capable kind when absent */
  readonly kinds?: ReadonlyArray<AgentKind>
}

/** one agent's on-disk session store */
export interface SessionSource {
  readonly kind: AgentKind
  readonly discover: (home: string, limit: number) => Promise<ReadonlyArray<DiscoveredSession>>
}
