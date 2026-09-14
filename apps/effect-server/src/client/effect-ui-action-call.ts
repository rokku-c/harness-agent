import type { StateStore } from "@json-render/core"

export type Params = Record<string, unknown>

export const headers = (method: string): HeadersInit =>
  method === "GET" ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" }

const template = (): RegExp => /\{([^}]+)\}/g
export const pathKeys = (url: string): readonly string[] => [...url.matchAll(template())].map((match) => match[1]!)

export const addressed = (url: string, params: Params): boolean =>
  pathKeys(url).every((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")

const payloadOf = (params: Params, url: string): Params => {
  const consumed = pathKeys(url)
  return Object.fromEntries(Object.entries(params).filter(([key]) => !consumed.includes(key)))
}

export const init = (url: string, method: string, params: Params): RequestInit =>
  ({ method, headers: headers(method), ...(method === "GET" ? {} : { body: JSON.stringify(payloadOf(params, url)) }) })

export const requestUrl = (url: string, method: string, params: Params, baseUrl: string): string => {
  const templated = url.replace(template(), (_, key: string) => encodeURIComponent(String(params[key] ?? "")))
  const query = payloadOf(params, url)
  if (method !== "GET" || Object.keys(query).length === 0) return templated
  const target = new URL(templated, baseUrl)
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, String(value ?? ""))
  return target.pathname + target.search
}

export const bodyOf = (body: unknown, status: number): unknown =>
  typeof body === "object" && body !== null ? body : { ok: status >= 200 && status < 300, value: body }

export const refusal = (parsed: unknown, status: number): { ok: false; error: string } => {
  const body = parsed as { detail?: string; error?: string } | undefined
  return { ok: false, error: body?.detail ?? body?.error ?? `HTTP ${status}` }
}

const isStateRef = (value: unknown): value is { readonly state: string } =>
  typeof value === "object" && value !== null && "state" in value && typeof (value as { state: unknown }).state === "string"

export const declared = (params: Params | undefined, store: StateStore): Params =>
  Object.fromEntries(Object.entries(params ?? {}).map(([key, value]) =>
    [key, isStateRef(value) ? store.get(value.state) : value]))
