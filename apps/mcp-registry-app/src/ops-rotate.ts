import { OperationFault } from "@effect-agent/effect-interface"
import type { Registry } from "@effect-agent/mcp-registry"
import { TOKEN_MIN_LENGTH } from "./effect-config.ts"
import type { RotatedTokens } from "./rotated-tokens.ts"

export const rotateToken = (registry: Registry, rotated: RotatedTokens, serverId: string, newToken: string): unknown => {
  if (registry.get(serverId) === undefined) {
    throw new OperationFault(404, `the registry holds no server ${serverId}; register it first, and the token entered there authorizes it`)
  }
  if (newToken.length < TOKEN_MIN_LENGTH) {
    throw new OperationFault(400, `a token is at least ${TOKEN_MIN_LENGTH} characters, the same rule the registry's configured tokens are held to; enter a longer one and press again`)
  }
  rotated.replace(serverId, newToken)
  return { ok: true, serverId }
}
