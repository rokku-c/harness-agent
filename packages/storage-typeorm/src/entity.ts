import { EntitySchema } from "typeorm"

export interface StoredEntity {
  key: string
  type?: string
  createdAt: number
  value: string
}

export const storedEntity = new EntitySchema<StoredEntity>({
  name: "EffectAgentValue",
  tableName: "effect_agent_values",
  columns: {
    key: { type: String, primary: true },
    type: { type: String, nullable: true },
    createdAt: { type: Number },
    value: { type: "text" }
  },
  indices: [
    { name: "idx_effect_agent_value_type", columns: ["type"] },
    { name: "idx_effect_agent_value_created", columns: ["createdAt"] }
  ]
})
