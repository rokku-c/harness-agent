import { Effect } from "effect"
import type { GatewayEvent, GatewayRecorder } from "@effect-agent/ai-gateway"
import { TypeOrmStore } from "@effect-agent/storage-typeorm"

export interface StoredGatewayRecorder extends GatewayRecorder {
  events(): Promise<ReadonlyArray<GatewayEvent>>
  close(): Promise<void>
}

export const typeOrmRecorder = (database: string): StoredGatewayRecorder => {
  const store = TypeOrmStore.open({ database })
  let sequence = 0
  return {
    record: async (event) => {
      const key = `ai-gateway/${event.at}/${event.requestId}/${sequence++}`
      await Effect.runPromise((await store).put(key, { type: "ai-gateway.event", event }))
    },
    events: async () => {
      const rows = await Effect.runPromise((await store).query({ type: "ai-gateway.event" }))
      return rows.map((row) => (row as { event: GatewayEvent }).event)
    },
    close: async () => { await (await store).close() }
  }
}
