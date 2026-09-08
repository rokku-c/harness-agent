export interface ListenerSpec {
  readonly id: string
  readonly hostname?: string
  readonly port: number
  readonly apps?: readonly string[]
}
export interface ListenerInfo extends ListenerSpec { readonly hostname: string; readonly url: string }
export interface ListenerServer {
  readonly hostname: string | undefined
  readonly port: number | undefined
  readonly url: URL | string
  stop(closeActiveConnections?: boolean): void | Promise<void>
}
export interface ListenerManagerOptions {
  readonly handle: (request: Request) => Promise<Response>
  readonly resolveApp?: (request: Request) => string | undefined
  readonly listen?: (options: {
    hostname: string; port: number; fetch: (request: Request) => Promise<Response>
  }) => ListenerServer
}

/** Stop accepting immediately, but never await drainage: a request may close its own port. */
const stopAccepting = (server: ListenerServer): void => {
  const drained = server.stop(false)
  if (drained) void drained.catch(cause => console.error("listener graceful drain failed", cause))
}

export const makeListenerManager = (options: ListenerManagerOptions) => {
  const listen = options.listen ?? ((config) => Bun.serve(config))
  const entries = new Map<string, { info: ListenerInfo; server: ListenerServer }>()
  const reserved = new Set<string>()
  let closed = false
  let closing: Promise<void> | undefined
  const register = async (spec: ListenerSpec): Promise<() => Promise<void>> => {
    if (closed) throw new Error("listener manager is closed")
    if (!spec.id) throw new Error("listener id is required")
    if (entries.has(spec.id) || reserved.has(spec.id)) throw new Error(`duplicate listener id: ${spec.id}`)
    if (!Number.isInteger(spec.port) || spec.port < 0 || spec.port > 65535) throw new Error("invalid listener port")
    if (spec.apps !== undefined && !options.resolveApp) throw new Error("listener apps filter requires resolveApp")
    const apps = spec.apps === undefined ? undefined : [...spec.apps]
    const allowed = apps === undefined ? undefined : new Set(apps)
    const fetch = allowed === undefined ? options.handle : async (request: Request) => {
      const app = options.resolveApp!(request)
      if (app === undefined) return new Response("Not Found", { status: 404 })
      if (!allowed.has(app)) return new Response("Forbidden", { status: 403 })
      return options.handle(request)
    }
    reserved.add(spec.id)
    try {
      const hostname = spec.hostname ?? "127.0.0.1"
      const server = listen({ hostname, port: spec.port, fetch })
      if (closed || server.port === undefined) {
        stopAccepting(server)
        throw new Error(closed ? "listener manager is closed" : "listener did not bind a TCP port")
      }
      const info = { id: spec.id, hostname: server.hostname ?? hostname, port: server.port,
        url: server.url.toString(), ...(apps === undefined ? {} : { apps }) }
      const entry = { info, server }
      entries.set(spec.id, entry)
      return async () => {
        if (entries.get(spec.id) !== entry) return
        stopAccepting(server)
        entries.delete(spec.id)
      }
    } finally { reserved.delete(spec.id) }
  }
  return {
    register,
    list: (): ListenerInfo[] => [...entries.values()].map(({ info }) => ({
      ...info, ...(info.apps === undefined ? {} : { apps: [...info.apps] }),
    })),
    /** Resolves once all listeners stop accepting; active streams retain their natural lifetime. */
    close: (): Promise<void> => {
      if (closing) return closing
      closed = true
      const failures: unknown[] = []
      for (const [id, entry] of entries) {
        try { stopAccepting(entry.server); entries.delete(id) }
        catch (cause) { failures.push(cause) }
      }
      closing = failures.length ? Promise.reject(new AggregateError(failures, "listener shutdown failed")) : Promise.resolve()
      return closing
    },
  }
}
