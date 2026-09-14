import type { RegistryAuth } from "@effect-agent/mcp-registry"

export interface RotatedTokens {
  holds(serverId: string): boolean
  accepts(serverId: string, token: string): boolean
  replace(serverId: string, token: string): void
}

export const makeRotatedTokens = (): RotatedTokens => {
  const byId = new Map<string, string>()
  return {
    holds: (serverId) => byId.has(serverId),
    accepts: (serverId, token) => byId.get(serverId) === token,
    replace: (serverId, token) => { byId.set(serverId, token) },
  }
}

export const authorizeWith = (rotated: RotatedTokens, configured: RegistryAuth): RegistryAuth =>
  ({ authorize: (token, serverId) => rotated.holds(serverId) ? rotated.accepts(serverId, token) : configured.authorize(token, serverId) })
