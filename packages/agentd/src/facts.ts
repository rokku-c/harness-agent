import { selectSession, selectSessions } from "./facts-sessions.ts"
import type { LocatedSession, SessionQuery, SessionRecord } from "./facts-sessions.ts"

export interface MachineReport {
  readonly machineId: string
  readonly facts?: unknown
  readonly sessions?: readonly SessionRecord[]
  readonly factsAt?: number
  readonly sessionsAt?: number
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
    session: (machineId: string, kind: string, sessionId: string): LocatedSession | undefined =>
      selectSession([...reports.values()], machineId, kind, sessionId),
  }
}
export type FactsRegistry = ReturnType<typeof makeFactsRegistry>
