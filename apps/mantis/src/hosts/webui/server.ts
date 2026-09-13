/**
 * Barrel: the web console HTTP surface split by CONCEPT (see ./server/).
 * mount.ts = the mount-prefix arithmetic; assets.ts = the panel's own files;
 * api.ts = one request to one MCP call; helpers.ts = shared translator
 * helpers; routes/ = one file per API family; serve.ts = the Bun.serve shell
 * (serveConsole), which is the standalone host's surface and only its.
 */
export type { ServeOptions } from "./server/serve.ts"
export { serveConsole } from "./server/serve.ts"
