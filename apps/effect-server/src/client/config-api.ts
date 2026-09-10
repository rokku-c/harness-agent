import type { JsonSchema } from "@effect-agent/effect-ui"

export type SaveStrategy = "apply" | "restart"
export interface ConfigState {
  appId: string
  ok: boolean
  pendingRestart: boolean
  revision?: number
  error?: string
}
export interface ConfigDescription extends ConfigState {
  kind: "config"
  id: string
  schema: JsonSchema
  jsonSpec?: unknown
  value: Record<string, unknown>
  sources: Record<string, string>
}
export type ConfigFailure = Error & { status?: number; data?: Partial<ConfigState> }
export type ConfigFetch = (url: string, init?: RequestInit) => Promise<Response>

/** No HTTP error (including a misleading {ok:true}) may become a success. */
export function createConfigApi(fetcher: ConfigFetch) {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
  const request = async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
    const response = await fetcher(url, { cache: "no-store", ...init })
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { throw new Error(`HTTP ${response.status}: response is not valid JSON`) }
    if (!response.ok || !record(data) || data.ok === false) {
      const detail = record(data) ? data.error ?? data.detail : undefined
      throw Object.assign(new Error(`HTTP ${response.status}: ${typeof detail === "string" ? detail : "config request failed"}`),
        { status: response.status, data: record(data) ? data : {} })
    }
    return data
  }
  const path = (id: string) => `/console/api/config/${encodeURIComponent(id)}`
  const get = async (id: string): Promise<ConfigDescription> => {
    const data = await request(path(id))
    if (data.kind !== "config" || data.id !== id || data.ok !== true || !record(data.schema) ||
      !record(data.value) || !record(data.sources) || typeof data.pendingRestart !== "boolean") throw new Error("config response contract is incomplete")
    return data as unknown as ConfigDescription
  }
  const mutation = async (id: string, applyOnly: boolean, body?: object): Promise<ConfigState> => {
    const data = await request(path(id) + (applyOnly ? "/apply" : ""), {
      method: "POST", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    })
    if (data.ok !== true || data.appId !== id || typeof data.pendingRestart !== "boolean") throw new Error("save response contract is incomplete; reload to confirm state")
    return data as unknown as ConfigState
  }
  return {
    get,
    save: (id: string, override: Record<string, unknown>, strategy: SaveStrategy, unset: readonly string[] = []) => {
      if (strategy !== "apply" && strategy !== "restart") throw new Error("strategy must be apply or restart")
      return mutation(id, false, { override, strategy, unset })
    },
    apply: (id: string) => mutation(id, true),
  }
}
export type ConfigApi = ReturnType<typeof createConfigApi>
