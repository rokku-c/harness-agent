import { Effect } from "effect"
import { MoreThan, type DataSource } from "typeorm"
import type { EventLogService, SessionEvent } from "@effect-agent/state"
import { eventEntity } from "./event-entity.ts"

const decoded = (row: { seq: number; ts: number; session: string; type: string; data: string }): SessionEvent =>
  ({ seq: row.seq, ts: row.ts, session: row.session, type: row.type, data: JSON.parse(row.data) as unknown })

export const typeOrmEventLog = (source: DataSource): EventLogService => {
  const repository = source.getRepository(eventEntity)
  return {
    append: (session, type, data) => Effect.promise(async () => source.transaction(async (manager) => {
      const events = manager.getRepository(eventEntity)
      const latest = await events.findOne({ where: { session }, order: { seq: "DESC" } })
      const seq = (latest?.seq ?? 0) + 1
      await events.save({ seq, ts: Date.now(), session, type, data: JSON.stringify(data) })
      return seq
    })),
    stream: (session, afterSeq = 0) => Effect.promise(async () =>
      (await repository.find({ where: { session, seq: MoreThan(afterSeq) }, order: { seq: "ASC" } })).map(decoded)),
    all: () => Effect.promise(async () =>
      (await repository.find({ order: { id: "ASC" } })).map(decoded))
  }
}
