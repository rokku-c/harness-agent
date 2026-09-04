/**
 * Barrel: the web console HTTP surface split by CONCEPT (see ./server/).
 * helpers.ts = shared translator helpers; routes/ = one file per API
 * family; serve.ts = the Bun.serve shell (serveConsole).
 */
export type { ServeOptions } from "./server/serve.ts"
export { serveConsole } from "./server/serve.ts"
