/**
 * Finding one session among what the machines reported.
 *
 * Separate from the registry that holds the reports because it answers a
 * different question: the registry is "what did each machine say", and this is
 * "which of them is the session I was told about". Both are pure reads over the
 * stored reports, so neither needs the clock the registry writes with.
 */
import type { MachineReport } from "./facts.ts"

export interface SessionRecord {
  /** `claude-code`, `codex`, `gemini`, `pi`: the machine's vocabulary, not ours. */
  readonly kind: string
  readonly sessionId: string
  readonly cwd?: string
  readonly title?: string
  /** When the session was last written on that machine. */
  readonly updatedAt: number
  readonly bytes: number
  /** Where it was found, so an operator can go and look at it. */
  readonly source?: string
  /**
   * The end of the transcript, as the machine last reported it. Bounded by the
   * machine, and absent for a session it listed but did not send — the center
   * holds a tail, never a copy, because the full transcript stays on the disk it
   * was written to.
   */
  readonly tail?: string
}

/** A session with the machine it was found on, which is what names it. */
export type LocatedSession = SessionRecord & { readonly machineId: string }

export interface SessionQuery {
  readonly machineId?: string
  readonly kind?: string
  /** Newest first, capped. Absent = everything the center holds. */
  readonly limit?: number
}

const locate = (report: MachineReport): ReadonlyArray<LocatedSession> =>
  (report.sessions ?? []).map((session) => ({ ...session, machineId: report.machineId }))

/**
 * Every session the center knows, newest first. An agent asking "what work has
 * been done here" wants one list across machines, not a walk of them.
 */
export const selectSessions = (
  reports: ReadonlyArray<MachineReport>,
  query: SessionQuery = {}
): ReadonlyArray<LocatedSession> => {
  const found = reports
    .filter((report) => query.machineId === undefined || report.machineId === query.machineId)
    .flatMap(locate)
    .filter((session) => query.kind === undefined || session.kind === query.kind)
    .sort((left, right) => right.updatedAt - left.updatedAt)
  return query.limit === undefined ? found : found.slice(0, query.limit)
}

/**
 * One session, by the three things that name it. An agent asking to read the
 * work an agent before it did knows which machine, which kind and which id;
 * anything less would be a search, and a search can answer with a neighbour.
 *
 * A conversation resumed in several working directories has a record per
 * directory, so the newest record wins: an older copy is a transcript that stops
 * before the work the caller came to read.
 */
export const selectSession = (
  reports: ReadonlyArray<MachineReport>,
  machineId: string,
  kind: string,
  sessionId: string
): LocatedSession | undefined =>
  reports
    .filter((report) => report.machineId === machineId)
    .flatMap(locate)
    .filter((session) => session.kind === kind && session.sessionId === sessionId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0]
