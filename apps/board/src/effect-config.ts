import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import type { StorePolicy } from "./storage/database.ts"

const schema = z.object({
  dataFile: z.string().min(1).default(".effect-agent/board.sqlite"),
  /**
   * What board does with a data file this build cannot read. `clean` moves it
   * aside and starts fresh, which is the right default while these stores hold
   * test data; a deployment whose board holds real tasks sets `refuse` and
   * decides itself. Neither ever deletes or rewrites the file.
   */
  incompatibleStore: z.enum(["clean", "refuse"]).default("clean"),
}).strict()

export const effectConfig: ConfigDeclaration = {
  appId: "board", title: "Board", schema,
}

export interface BoardSettings {
  readonly dataFile: string
  readonly incompatibleStore: StorePolicy
}

/**
 * The board's settings, whatever shape they arrive in. The platform's config
 * store is one such shape and standalone mode's environment is another, so the
 * defaults live here once rather than in each of the places that start a board —
 * and a value this build cannot read is refused at boot instead of replaced.
 */
export const boardSettings = (input: unknown): BoardSettings => schema.parse(input)
