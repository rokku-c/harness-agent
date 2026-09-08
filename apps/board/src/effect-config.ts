import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

export const effectConfig: ConfigDeclaration = {
  appId: "board", title: "Board",
  schema: z.object({ dataFile: z.string().min(1).default(".effect-agent/board.sqlite") }).strict(),
}
