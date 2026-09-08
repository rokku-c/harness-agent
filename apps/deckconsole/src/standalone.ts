import { createDeckApp, type DeckOptions } from "./app.ts"

export interface DeckServerOptions extends DeckOptions { readonly host?: string; readonly port?: number }
/** Explicitly self-managed listener; embedded plugins do not import this module. */
export const startDeckServer = (options: DeckServerOptions = {}) => {
  const app = createDeckApp(options)
  try {
    const hostname = options.host ?? "127.0.0.1"
    const server = Bun.serve({ hostname, port: options.port ?? 4851, fetch: app.handle })
    let closing: Promise<void> | undefined
    const close = () => closing ??= (async () => { try { await server.stop(true) } finally { await app.close() } })()
    const baseHost = hostname === "0.0.0.0" || hostname === "::" ? "127.0.0.1" : hostname
    return { server, deck: app.deck, base: "http://" + baseHost + ":" + server.port, close }
  } catch (error) { void app.close(); throw error }
}
