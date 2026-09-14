import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import type { StorePolicy } from "./storage/database.ts"

const schema = z.object({
  dataFile: z.string().min(1).default(".effect-agent/board.sqlite"),
  incompatibleStore: z.enum(["clean", "refuse"]).default("clean"),
}).strict()

export const effectConfig: ConfigDeclaration = {
  appId: "board", title: "Board", schema,
}

export interface BoardSettings {
  readonly dataFile: string
  readonly incompatibleStore: StorePolicy
}

export const boardSettings = (input: unknown): BoardSettings => schema.parse(input)
