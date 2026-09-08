/** In-memory MCP catalog with authenticated control-plane operations. */

import { chooseRecord, type RegistryPreference } from "./selection.ts"
import {
  statusFor,
  type McpServer,
  type McpServerRecord,
  type RegistryOptions,
  type StaticRegistrationOptions,
} from "./contract.ts"

export interface Registry {
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
  lastSeen: number
}

const DEFAULT_TTL_MS = 2_000
const DEFAULT_OFFLINE_MS = 60_000

export function makeRegistry(options?: RegistryOptions): Registry {
  const clock = options?.now ?? Date.now
  const ttl = options?.heartbeatTtlMs ?? DEFAULT_TTL_MS
  const offlineAfter = options?.offlineAfterMs ?? DEFAULT_OFFLINE_MS
  const byId = new Map<string, Stored>()
  const auth = options?.auth

  const toRecord = (stored: Stored, at: number): McpServerRecord => ({
    ...stored.server,
    ...(stored.ownerId === undefined ? {} : { ownerId: stored.ownerId }),
    status: statusFor(stored.lastSeen, at, ttl, offlineAfter),
    lastSeen: stored.lastSeen,
    registeredAt: stored.registeredAt,
  })
  const list = (at?: number): McpServerRecord[] => [...byId.values()].map((s) => toRecord(s, at ?? clock()))
  const authorized = (serverId: string, token: string): boolean => auth?.authorize(token, serverId) === true

  const upsert = (server: McpServer, registration?: StaticRegistrationOptions, renew = false): McpServerRecord => {
    const now = clock(), existing = byId.get(server.serverId)
    const stored: Stored = existing
      ? { ...existing, server, ...(renew ? { lastSeen: now } : {}), ...(registration?.ownerId === undefined ? {} : { ownerId: registration.ownerId }) }
      : { server, registeredAt: now, lastSeen: now, ownerId: registration?.ownerId }
    byId.set(server.serverId, stored)
    return toRecord(stored, now)
  }
  const register = (server: McpServer, registration?: StaticRegistrationOptions): McpServerRecord => upsert(server, registration)
  const touch = (serverId: string, at?: number): boolean => {
    const stored = byId.get(serverId)
    if (!stored) return false
    stored.lastSeen = at ?? clock()
    return true
  }

  return {
    register,
    touch,
    unregister: (serverId) => byId.delete(serverId),
    announce: (server, token) => {
      if (!authorized(server.serverId, token)) throw new Error("registry: unauthorized announce")
      return upsert(server, undefined, true)
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
        const record = byId.get(prefer.serverId)
        if (record === undefined) return undefined
        const value = toRecord(record, now)
        return value.status === "offline" ? undefined : value
      }
      return chooseRecord(list(now), prefer)
    },
  }
}
