/**
 * Barrel: the dws channel split by CONCEPT (see ./dws/).
 * runner.ts = the dws CLI seam; source.ts = source addressing + args;
 * parse.ts = payload normalization; channel.ts = the poll loop.
 */
export type { DwsRunner } from "./dws/runner.ts"
export { dwsBunRunner } from "./dws/runner.ts"
export type { DwsSource, DwsChannelOptions } from "./dws/source.ts"
export { toIncoming, parseDwsList } from "./dws/parse.ts"
export { makeDwsChannel } from "./dws/channel.ts"
