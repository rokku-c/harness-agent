import type { MachineReport } from "./facts.ts"

export interface SessionRecord {
  readonly kind: string
  readonly sessionId: string
  readonly cwd?: string
  readonly title?: string
  readonly updatedAt: number
  readonly bytes: number
  readonly source?: string
  readonly tail?: string
}

export type LocatedSession = SessionRecord & { readonly machineId: string }

export interface SessionQuery {
  readonly machineId?: string
  readonly kind?: string
  readonly limit?: number
}

const locate = (report: MachineReport): ReadonlyArray<LocatedSession> =>
  (report.sessions ?? []).map((session) => ({ ...session, machineId: report.machineId }))

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
