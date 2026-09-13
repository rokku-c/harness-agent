import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

export const effectConfig: ConfigDeclaration = {
  appId: "board", title: "Board",
  schema: z.object({
    dataFile: z.string().min(1).default(".effect-agent/board.sqlite"),
    /**
     * What board does with a data file this build cannot read. `clean` moves it
     * aside and starts fresh, which is the right default while these stores hold
     * test data; a deployment whose board holds real tasks sets `refuse` and
     * decides itself. Neither ever deletes or rewrites the file.
     */
    incompatibleStore: z.enum(["clean", "refuse"]).default("clean"),
  }).strict(),
}
