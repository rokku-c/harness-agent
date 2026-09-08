import type { RegistryAuth } from "./auth.ts"

/**
 * mcp-registry contract — catalog of MCP servers & apps.
 *
 * Status is derived from heartbeat freshness, never stored as a value.
 */

export type ProtocolEra = "modern" | "auto" | "legacy"
export type ServerStatus = "healthy" | "warn" | "offline"

export interface McpServerTransport {
  readonly kind: "stdio" | "streamable-http"
  readonly endpoint?: string
}

export interface McpServerCapabilities {
  readonly tools?: number
  readonly resources?: number
  readonly prompts?: number
  readonly apps?: number
}

export interface McpServer {
  readonly serverId: string
  readonly name: string
  readonly version: string
  readonly namespace?: string
  readonly era: ProtocolEra
  readonly transport: McpServerTransport
  readonly capabilities?: McpServerCapabilities
  readonly apps?: readonly string[]
}

export interface McpServerRecord extends McpServer {
  readonly status: ServerStatus
  readonly lastSeen: number
  readonly registeredAt: number
  /** Public identity only; credentials are never part of a record. */
  readonly ownerId?: string
}

export interface StaticRegistrationOptions {
  /** Optional public owner identity for a trusted, local registration. */
  readonly ownerId?: string
}

export interface RegistryOptions {
  readonly heartbeatTtlMs?: number
  readonly offlineAfterMs?: number
  readonly now?: () => number
  /** Required by the authenticated announce/heartbeat/withdraw controls. */
  readonly auth?: RegistryAuth
}

export const ERA_RANK: Readonly<Record<ProtocolEra, number>> = {
  modern: 0,
  auto: 1,
  legacy: 2,
}

export function statusFor(lastSeen: number, now: number, healthyUntilMs: number, offlineAfterMs: number): ServerStatus {
  const age = Math.max(0, now - lastSeen)
  if (age >= offlineAfterMs) return "offline"
  if (age >= healthyUntilMs) return "warn"
  return "healthy"
}
