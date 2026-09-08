import type { EffectRegistry } from "@effect-agent/effect-interface"

export interface MeshEndpoint { readonly url: string }
export interface MeshCall { readonly ns: string; readonly appId: string; readonly tool: string }
export interface MeshRemoteCall {
  (c: MeshCall, args: unknown, opts?: { byNamespace?: string }): Promise<unknown>
}
export interface MeshAnnounce {
  readonly ns: string
  readonly appId: string
  readonly registry?: EffectRegistry
  readonly remote?: MeshRemoteCall
  readonly capabilities?: readonly string[]
  readonly endpoint?: MeshEndpoint
  readonly eventsUrl?: string
}
export interface MeshNode {
  readonly key: string; readonly ns: string; readonly appId: string
  readonly capabilities: readonly string[]
}
export interface MeshDiscover { readonly ns?: string; readonly capability?: string }
export interface MeshAudit {
  readonly ns: string; readonly appId: string; readonly tool: string
  readonly args?: unknown; readonly byNamespace?: string
}
export interface MeshOptions { readonly onCall?: (audit: MeshAudit) => void | Promise<void> }
export interface EffectMesh {
  announce(a: MeshAnnounce): () => void
  leave(key: string): boolean
  list(): readonly MeshNode[]
  discover(q: MeshDiscover): readonly MeshNode[]
  grant(fromNs: string, toNs: string): void
  revoke(fromNs: string, toNs: string): void
  can(fromNs: string | undefined, toNs: string): boolean
  call(c: MeshCall, args: unknown, opts?: { byNamespace?: string }): Promise<unknown>
  push(c: { ns: string; appId: string }, payload: unknown): Promise<void>
}

export interface MeshEntry {
  readonly announce: MeshAnnounce
  readonly registry?: EffectRegistry
  readonly endpoint?: MeshEndpoint
  readonly eventsUrl?: string
  readonly remote?: MeshRemoteCall
}
export const toolKey = (ns: string, appId: string, tool: string): string => `${ns}::${appId}.${tool}`
