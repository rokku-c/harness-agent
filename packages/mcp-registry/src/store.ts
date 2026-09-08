/** In-memory MCP catalog with authenticated control-plane operations. */

import { makeRuntimeConfig } from "./config.ts"
import { chooseRecord, type RegistryPreference } from "./selection.ts"
import {
  statusFor,
  type McpServer,
  type McpServerRecord,
  type RegistryConfig,
  type RegistryLease,
  type RegistryOptions,
  type StaticRegistrationOptions,
} from "./contract.ts"

export interface Registry {
  configure(config: RegistryConfig): () => void
  register(server: McpServer, options?: StaticRegistrationOptions): McpServerRecord
  touch(serverId: string, at?: number): boolean
  unregister(serverId: string): boolean
  announce(server: McpServer, token: string): McpServerRecord
  heartbeat(serverId: string, token: string, at?: number): boolean
  withdraw(serverId: string, token: string): boolean
  get(serverId: string, at?: number): McpServerRecord | undefined
  list(at?: number): McpServerRecord[]
  choose(prefer?: RegistryPreference, at?: number): McpServerRecord | undefined
}

interface Stored {
  readonly server: McpServer
  readonly registeredAt: number
  readonly ownerId?: string
  readonly lease: RegistryLease
  lastSeen: number
}

export function makeRegistry(options: RegistryOptions = {}): Registry {
  const clock = options.now ?? Date.now
  const byId = new Map<string, Stored>()
  const runtime = makeRuntimeConfig(options)
  const toRecord = (stored: Stored, at: number): McpServerRecord => {
    const config = runtime.get()
    return {
      ...stored.server,
      ...(stored.ownerId === undefined ? {} : { ownerId: stored.ownerId }),
      status: statusFor(stored.lastSeen, at, config.heartbeatTtlMs, config.offlineAfterMs, stored.lease),
      lastSeen: stored.lastSeen,
      registeredAt: stored.registeredAt,
    }
  }
  const list = (at?: number): McpServerRecord[] => [...byId.values()].map((s) => toRecord(s, at ?? clock()))
  const authorized = (serverId: string, token: string): boolean => runtime.get().auth?.authorize(token, serverId) === true

  const upsert = (server: McpServer, registration: StaticRegistrationOptions | undefined, lease: RegistryLease, renew: boolean) => {
    const now = clock(), existing = byId.get(server.serverId)
    const stored: Stored = existing
      ? { ...existing, server, lease, ...(renew ? { lastSeen: now } : {}), ...(registration?.ownerId === undefined ? {} : { ownerId: registration.ownerId }) }
      : { server, registeredAt: now, lastSeen: now, lease, ownerId: registration?.ownerId }
    byId.set(server.serverId, stored)
    return toRecord(stored, now)
  }
  const register = (server: McpServer, registration?: StaticRegistrationOptions) => upsert(server, registration, "static", false)
  const touch = (serverId: string, at?: number): boolean => {
    const stored = byId.get(serverId)
    if (!stored) return false
    stored.lastSeen = at ?? clock()
    return true
  }

  return {
    configure: runtime.configure,
    register,
    touch,
    unregister: (serverId) => byId.delete(serverId),
    announce: (server, token) => {
      if (!authorized(server.serverId, token)) throw new Error("registry: unauthorized announce")
      return upsert(server, undefined, "dynamic", true)
    },
    heartbeat: (serverId, token, at) => authorized(serverId, token) && touch(serverId, at),
    withdraw: (serverId, token) => authorized(serverId, token) && byId.delete(serverId),
    get: (serverId, at) => {
      const stored = byId.get(serverId)
      return stored === undefined ? undefined : toRecord(stored, at ?? clock())
    },
    list,
    choose: (prefer, at) => {
      const now = at ?? clock()
      if (prefer?.serverId) {
        const stored = byId.get(prefer.serverId)
        if (stored === undefined) return undefined
        const record = toRecord(stored, now)
        return record.status === "offline" ? undefined : record
      }
      return chooseRecord(list(now), prefer)
    },
  }
}
