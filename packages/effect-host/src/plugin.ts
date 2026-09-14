import type { RoutePattern, RegisteredRoute } from "./routes.ts"
import type { HostReloadResult } from "./operations.ts"

export interface LoadedPlane {
  readonly tools?: readonly unknown[]
  readonly canHandle?: (path: string) => boolean
  readonly handle: (request: Request) => Promise<Response>
  readonly stop?: () => void | Promise<void>
}

export interface EffectPlugin {
  readonly routes?: readonly RoutePattern[]
  readonly id: string
  readonly priority?: number
  readonly enabled?: boolean
  load(): Promise<LoadedPlane>
}

export interface HostRoute {
  readonly appId?: string
  readonly path: string
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  handle(request: Request): Promise<Response>
}

export interface EffectPluginHost {
  routes(): readonly RegisteredRoute[]
  resolveApp(request: Request): string | undefined
  list(): ReadonlyArray<{ readonly id: string; readonly enabled: boolean; readonly priority: number }>
  register(plugin: EffectPlugin): Promise<void>
  unregister(id: string, expectedPlugin?: EffectPlugin): Promise<boolean>
  enable(id: string): Promise<boolean>
  disable(id: string): Promise<boolean>
  isEnabled(id: string): boolean
  reload?(id: string): Promise<HostReloadResult>
  registerRoute(route: HostRoute): () => void
  handle(request: Request): Promise<Response>
  close(): Promise<void>
}
