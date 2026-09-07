import { EntitySchema } from "typeorm"

export interface EventEntity {
  id?: number
  seq: number
  ts: number
  session: string
  type: string
  data: string
}

export const eventEntity = new EntitySchema<EventEntity>({
  name: "EffectAgentEvent",
  tableName: "effect_agent_events",
  columns: {
    id: { type: Number, primary: true, generated: true },
    seq: { type: Number },
    ts: { type: Number },
    session: { type: String },
    type: { type: String },
    data: { type: "text" }
  },
  indices: [
    { name: "idx_effect_agent_event_session_seq", columns: ["session", "seq"], unique: true },
    { name: "idx_effect_agent_event_type", columns: ["type"] }
  ]
})
