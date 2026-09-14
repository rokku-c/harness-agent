import { boardSettings, type BoardSettings } from "../effect-config.ts"

export const standaloneSettings = (): BoardSettings =>
  boardSettings({
    dataFile: process.env.BOARD_DATA_FILE,
    incompatibleStore: process.env.BOARD_INCOMPATIBLE_STORE,
  })
