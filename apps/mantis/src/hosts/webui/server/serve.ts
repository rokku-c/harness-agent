import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { makeApiHandler } from "./api.ts"

export interface ServeOptions {
  readonly client: Client
  readonly basePath?: string
  readonly host?: string
  readonly port?: number
}

export const serveConsole = (options: ServeOptions): { url: string; stop: () => void } => {
  const host = options.host ?? "127.0.0.1"
  const port = options.port ?? 3737
  const api = makeApiHandler({ client: options.client, basePath: options.basePath })

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: api
  })
  const url = "http://" + host + ":" + server.port
  return { url, stop: () => server.stop(true) }
}
