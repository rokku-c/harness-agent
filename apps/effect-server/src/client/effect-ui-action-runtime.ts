import type { StateStore } from "@json-render/core"
import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"
import { loadSource } from "./effect-ui-source-runtime.ts"
import { addressed, bodyOf, declared, init, refusal, requestUrl, type Params } from "./effect-ui-action-call.ts"
import { mayRun, type Ask } from "./effect-ui-action-gate.ts"

export type OpenScreen = (screen: string, params: Params) => void

export interface ActionRuntimeOptions {
  readonly store: StateStore
  readonly ask: Ask
  readonly actions?: readonly UiActionSpec[]
  readonly sources?: readonly UiSourceSpec[]
  readonly open?: OpenScreen
  readonly fetcher?: typeof fetch
  readonly baseUrl?: string
}

export const makeActionHandlers = (options: ActionRuntimeOptions) => {
  const { store, ask, actions = [], sources = [], open = () => {}, fetcher = window.fetch.bind(window), baseUrl = window.location.origin } = options
  const declaredOf = (action: UiActionSpec, runtimeParams: Params): Params =>
    ({ ...declared(action.params, store), ...runtimeParams })

  const call = async (action: UiActionSpec, params: Params): Promise<boolean> => {
    const url = action.url
    if (url === undefined || !addressed(url, params)) return false
    const method = action.method ?? "POST"
    try {
      const response = await fetcher(requestUrl(url, method, params, baseUrl), init(url, method, params))
      const parsed = bodyOf(await response.json().catch(() => undefined), response.status)
      if (action.result !== undefined) store.set(action.result, response.ok ? parsed : refusal(parsed, response.status))
      return response.ok
    } catch (error) {
      if (action.result !== undefined) store.set(action.result, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  return Object.fromEntries(actions.map((action) => [action.name, async (runtimeParams: Params = {}) => {
    const params = declaredOf(action, runtimeParams)
    if (!await mayRun(action.confirm, ask)) return
    const ran = action.url !== undefined && await call(action, params)
    if (ran) for (const path of action.clear ?? []) store.set(path, "")
    if (ran || action.url === undefined) await Promise.all((action.refresh ?? []).map(async (id) => {
      const source = sources.find((candidate) => candidate.id === id)
      if (source !== undefined) return loadSource(source, store, fetcher)
      const read = actions.find((candidate) => candidate.name === id)
      if (read !== undefined) await call(read, declaredOf(read, {}))
    }))
    if (action.opens !== undefined) open(action.opens, params)
  }]))
}
