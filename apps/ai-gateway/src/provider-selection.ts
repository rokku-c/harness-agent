import { apiTypes, type ApiType, type GatewayProvider } from "./providers.ts"

type Ring = { ids: string[]; cursor: number }
export class ProviderSelectionError extends Error {
  constructor(readonly status: number, readonly type: string, message: string) { super(message) }
}

/** Handler-local rings: keep the next surviving ID on edits; new IDs follow config order. */
export const makeProviderSelector = () => {
  const rings = new Map<ApiType, Ring>()
  const sync = (providers: readonly GatewayProvider[]) => {
    for (const apiType of apiTypes) {
      const ids = providers.filter((p) => p.apiType === apiType && p.enabled !== false).map((p) => p.id)
      const previous = rings.get(apiType)
      if (previous?.ids.length === ids.length && previous.ids.every((id, i) => id === ids[i])) continue
      const pending = previous ? [...previous.ids.slice(previous.cursor), ...previous.ids.slice(0, previous.cursor)] : []
      const next = pending.find((id) => ids.includes(id))
      rings.set(apiType, { ids, cursor: next === undefined ? 0 : ids.indexOf(next) })
    }
  }
  return (providers: readonly GatewayProvider[], apiType: ApiType, selectedId: string | null) => {
    sync(providers)
    if (selectedId !== null) {
      const provider = providers.find((p) => p.id === selectedId)
      if (!provider) throw new ProviderSelectionError(404, "upstream_not_found", `ai-gateway: upstream id '${selectedId}' does not exist`)
      if (provider.enabled === false) throw new ProviderSelectionError(403, "upstream_disabled", `ai-gateway: upstream '${selectedId}' is disabled`)
      if (provider.apiType !== apiType) throw new ProviderSelectionError(400, "upstream_protocol_mismatch",
        `ai-gateway: upstream '${selectedId}' uses ${provider.apiType}, not ${apiType}`)
      return provider
    }
    const ring = rings.get(apiType)!
    if (!ring.ids.length) return undefined
    const id = ring.ids[ring.cursor]
    ring.cursor = (ring.cursor + 1) % ring.ids.length
    return providers.find((p) => p.id === id)!
  }
}
