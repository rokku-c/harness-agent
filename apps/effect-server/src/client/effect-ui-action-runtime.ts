import type { StateStore } from "@json-render/core"
import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"
import { loadSource } from "./effect-ui-source-runtime.ts"

type Params = Record<string, unknown>

/** Enters the screen an action names, carrying the values the press was made with. */
export type OpenScreen = (screen: string, params: Params) => void

const headers = (method: string): HeadersInit => method === "GET" ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" }

/** A `{name}` in the url is a path segment the server reads from the path. */
const template = (): RegExp => /\{([^}]+)\}/g
const pathKeys = (url: string): readonly string[] => [...url.matchAll(template())].map((match) => match[1]!)

/**
 * Only the params the url does not already carry travel on: a path parameter
 * sent again in the body is a second, unknown field to a strict schema — the
 * server rejects the whole request over a value it already has.
 */
const payloadOf = (params: Params, url: string): Params => {
  const consumed = pathKeys(url)
  return Object.fromEntries(Object.entries(params).filter(([key]) => !consumed.includes(key)))
}

const requestUrl = (url: string, method: string, params: Params, baseUrl: string): string => {
  const templated = url.replace(template(), (_, key: string) => encodeURIComponent(String(params[key] ?? "")))
  const query = payloadOf(params, url)
  if (method !== "GET" || Object.keys(query).length === 0) return templated
  const target = new URL(templated, baseUrl)
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, String(value ?? ""))
  return target.pathname + target.search
}

const bodyOf = (body: unknown, status: number): unknown => typeof body === "object" && body !== null ? body : { ok: status >= 200 && status < 300, value: body }

const isStateRef = (value: unknown): value is { readonly state: string } =>
  typeof value === "object" && value !== null && "state" in value && typeof (value as { state: unknown }).state === "string"

/**
 * A declared param may read view state — its type is `UiDynamicValue`, and apps
 * declare `{state: "/draft/title"}` on actions exactly as they do on presses.
 * Nothing else resolves that one: json-render resolves the params of a *press*,
 * but a spec's own params never pass through it, so a declaration carrying a
 * state path arrives here as the path's own JSON. A strict schema then refuses
 * the whole request over a field it was never meant to receive.
 *
 * Undefined drops out in the body, which is the point: a form control nobody
 * touched sends nothing rather than sending an empty answer to a question the
 * server did not ask.
 */
const declared = (params: Params | undefined, store: StateStore): Params =>
  Object.fromEntries(Object.entries(params ?? {}).map(([key, value]) =>
    [key, isStateRef(value) ? store.get(value.state) : value]))

/**
 * One press, one or two effects: read the thing, then show it.
 *
 * An action that says `url` reads; one that says `opens` enters a screen; one
 * that says both does the first and then the second, which is what opening a
 * record is — `result` fills, and the screen that renders it comes up. A read
 * that failed opens nothing: the screen would come up against a `result` that
 * says the fetch failed, which is the bug the two halves are ordered to avoid.
 */
export const makeActionHandlers = (actions: readonly UiActionSpec[] = [], sources: readonly UiSourceSpec[] = [], store: StateStore, open: OpenScreen = () => {}, fetcher: typeof fetch = window.fetch.bind(window), baseUrl = window.location.origin) =>
  Object.fromEntries(actions.map((action) => [action.name, async (runtimeParams: Params = {}) => {
    const method = action.method ?? "POST", params = { ...declared(action.params, store), ...runtimeParams }
    const url = action.url
    if (url !== undefined) {
      try {
        const response = await fetcher(requestUrl(url, method, params, baseUrl), {
          method, headers: headers(method), ...(method === "GET" ? {} : { body: JSON.stringify(payloadOf(params, url)) }),
        })
        const parsed = bodyOf(await response.json().catch(() => undefined), response.status)
        if (action.result !== undefined) store.set(action.result, response.ok ? parsed : { ok: false, error: (parsed as { detail?: string; error?: string }).detail ?? (parsed as { error?: string }).error ?? `HTTP ${response.status}` })
        if (!response.ok) return
        for (const path of action.clear ?? []) store.set(path, "")
        await Promise.all((action.refresh ?? []).map((id) => {
          const source = sources.find((candidate) => candidate.id === id)
          return source === undefined ? Promise.resolve() : loadSource(source, store, fetcher)
        }))
      } catch (error) {
        if (action.result !== undefined) store.set(action.result, { ok: false, error: error instanceof Error ? error.message : String(error) })
        return
      }
    }
    if (action.opens !== undefined) open(action.opens, params)
  }]))
