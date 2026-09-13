/**
 * What the machines are: the agents installed on each one, what those agents are
 * configured to talk to, and the sessions that machine has on disk.
 *
 * The center keeps what a machine reported and does not reinterpret it. Which
 * agents a machine has, and what each version writes into its own config file,
 * is that machine's business; a center that normalized it would need redeploying
 * every time an agent CLI changed its settings format, and would silently drop
 * whatever it did not recognize. So `facts` is passed through as it arrived, and
 * only the session index — the part callers filter and link to — has a shape.
 */
import { selectSession, selectSessions } from "./facts-sessions.ts"
import type { LocatedSession, SessionQuery, SessionRecord } from "./facts-sessions.ts"

export interface MachineReport {
  readonly machineId: string
  /** What the machine's probe said about its agents, as it said it. */
  readonly facts?: unknown
  /**
   * The sessions that machine has now — a snapshot, not a delta: a session the
   * machine no longer has is one it no longer reports, and a merged list could
   * only ever grow.
   */
  readonly sessions?: readonly SessionRecord[]
  readonly factsAt?: number
  readonly sessionsAt?: number
  /**
   * Why the last attempt said nothing, when it said nothing. An unreachable host
   * and an idle one both leave the previous snapshot standing, so without this
   * the center would show a machine that stopped answering as a quiet one.
   */
  readonly note?: string
  readonly noteAt?: number
}

export interface FactsRegistryOptions {
  readonly now?: () => number
}

export const makeFactsRegistry = (options: FactsRegistryOptions = {}) => {
  const now = options.now ?? Date.now
  const reports = new Map<string, MachineReport>()
  const edit = (machineId: string, patch: Partial<MachineReport>): MachineReport => {
    if (machineId === "") throw new Error("a report needs the machine it came from")
    const next: MachineReport = { ...(reports.get(machineId) ?? { machineId }), ...patch, machineId }
    reports.set(machineId, next)
    return next
  }
  return {
    putFacts: (machineId: string, facts: unknown): MachineReport => edit(machineId, { facts, factsAt: now() }),
    putSessions: (machineId: string, sessions: readonly SessionRecord[]): MachineReport =>
      edit(machineId, { sessions, sessionsAt: now() }),
    putNote: (machineId: string, note: string): MachineReport =>
      edit(machineId, { note, noteAt: now() }),
    get: (machineId: string): MachineReport | undefined => reports.get(machineId),
    list: (): readonly MachineReport[] => [...reports.values()],
    sessions: (query: SessionQuery = {}): ReadonlyArray<LocatedSession> => selectSessions([...reports.values()], query),
    /** One session by machine, kind and id — how an agent reads the one before it. */
    session: (machineId: string, kind: string, sessionId: string): LocatedSession | undefined =>
      selectSession([...reports.values()], machineId, kind, sessionId),
  }
}
export type FactsRegistry = ReturnType<typeof makeFactsRegistry>
