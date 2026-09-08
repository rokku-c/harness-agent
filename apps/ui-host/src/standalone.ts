import { makeWebHandler, type WebHandlerOptions } from "./web.ts"

export interface WebHostOptions extends WebHandlerOptions { readonly host?: string; readonly port?: number }
/** Only this explicit standalone entry allocates a listening socket. */
export const startWebHost = (options: WebHostOptions = {}) => {
  const app = makeWebHandler(options)
  try {
    const server = Bun.serve({ hostname: options.host ?? "127.0.0.1", port: options.port ?? 4870, fetch: app.handle })
    let closing: Promise<void> | undefined
    return { server, close: () => closing ??= (async () => {
      try { await server.stop(true) } finally { app.close() }
    })() }
  } catch (error) { app.close(); throw error }
}

if (import.meta.main) {
  const app = startWebHost({ host: process.env.UI_HOST, port: Number(process.env.UI_PORT ?? 4870), databaseFile: process.env.UI_DATABASE })
  console.log("ui-host listening on " + app.server.url)
  const close = async () => { await app.close(); process.exit(0) }
  process.once("SIGINT", close)
  process.once("SIGTERM", close)
}
