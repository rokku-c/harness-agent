import type { RoutePattern, RegisteredRoute } from "./routes.ts"
/**
 * effect-host plugin contract — the ONLY thing the host knows about the world.
 *
 * A plugin is contributed by an owning app/package (dependency direction:
 * plugin -> this package). The host registers plugins by id and lazily loads
 * each enabled one through `load()`, so importing a plugin module costs
 * nothing until it is actually enabled.
 */

export interface LoadedPlane {
  /** Instance-owned interfaces, registered/disposed by the app SDK. */
  readonly tools?: readonly unknown[]
  /** claim the request path (root/"everything" plugins return true). */
  readonly canHandle?: (path: string) => boolean
  readonly handle: (request: Request) => Promise<Response>
  readonly stop?: () => void | Promise<void>
}

export interface EffectPlugin {
  /** SDK-declared routes; independent of listener ports. */
  readonly routes?: readonly RoutePattern[]
  readonly id: string
  /** dispatch order; smaller runs first. Default 100. */
  readonly priority?: number
  /** boot-enabled? false registers without loading. Default true. */
  readonly enabled?: boolean
  /** build the loaded plane. Only called on enable. */
  load(): Promise<LoadedPlane>
}

/** A route any node can register on the host to accept requests. */
export interface HostRoute {
  readonly appId?: string
  /** exact path or prefix ending in "*". */
  readonly path: string
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  handle(request: Request): Promise<Response>
}

export interface EffectPluginHost {
  routes(): readonly RegisteredRoute[]
  resolveApp(request: Request): string | undefined
  list(): ReadonlyArray<{ readonly id: string; readonly enabled: boolean; readonly priority: number }>
  register(plugin: EffectPlugin): Promise<void>
  /** Remove only the matching plugin identity when expectedPlugin is supplied. */
  unregister(id: string, expectedPlugin?: EffectPlugin): Promise<boolean>
  enable(id: string): Promise<boolean>
  disable(id: string): Promise<boolean>
  isEnabled(id: string): boolean
  /** register a request route (dispatched before plugins); returns disposer. */
  registerRoute(route: HostRoute): () => void
  /** route one incoming request through the enabled, loaded plugins. */
  handle(request: Request): Promise<Response>
  /** Await queued operations, stop every plugin, and propagate/aggregate stop failures.
   * Idempotent; lifecycle mutations are rejected once shutdown begins. */
  close(): Promise<void>
}
