import { boardSettings, type BoardSettings } from "../effect-config.ts"

/**
 * The board's settings in standalone mode.
 *
 * A standalone listener is not a platform listener, so no config store is
 * registered and the declaration above has nothing to read. The environment is
 * read into it instead, which keeps the defaults in the declaration and keeps
 * `incompatibleStore` reachable without a platform — the one setting a
 * deployment holding real tasks has to be able to set.
 */
export const standaloneSettings = (): BoardSettings =>
  boardSettings({
    dataFile: process.env.BOARD_DATA_FILE,
    incompatibleStore: process.env.BOARD_INCOMPATIBLE_STORE,
  })
