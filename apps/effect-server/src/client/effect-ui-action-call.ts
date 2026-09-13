/**
 * One call: how it is addressed, and what came back.
 *
 * Split from the runtime that runs a press because it is a different question.
 * This file answers "what request, and what was the answer"; the runtime answers
 * "which effects, in what order". Nothing here fetches, and nothing here knows
 * what a press is.
 */
import type { StateStore } from "@json-render/core"

export type Params = Record<string, unknown>

export const headers = (method: string): HeadersInit =>
  method === "GET" ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" }

/** A `{name}` in the url is a path segment the server reads from the path. */
const template = (): RegExp => /\{([^}]+)\}/g
export const pathKeys = (url: string): readonly string[] => [...url.matchAll(template())].map((match) => match[1]!)

/**
 * Whether the call can be addressed at all: every id its path names has a value.
 * A parameter that is absent and one that is the empty string are one thing here
 * — both leave a segment of the url the declaration never named, which is a
 * request about something else, or about nothing.
 */
export const addressed = (url: string, params: Params): boolean =>
  pathKeys(url).every((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")

/**
 * Only the params the url does not already carry travel on: a path parameter
 * sent again in the body is a second, unknown field to a strict schema — the
 * server rejects the whole request over a value it already has.
 */
const payloadOf = (params: Params, url: string): Params => {
  const consumed = pathKeys(url)
  return Object.fromEntries(Object.entries(params).filter(([key]) => !consumed.includes(key)))
}

/** The request's own options: a write carries what the url did not take, a read carries nothing. */
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

/** Why a call failed, as the sentence the server sent or the status if it sent none. */
export const refusal = (parsed: unknown, status: number): { ok: false; error: string } => {
  const body = parsed as { detail?: string; error?: string } | undefined
  return { ok: false, error: body?.detail ?? body?.error ?? `HTTP ${status}` }
}

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
export const declared = (params: Params | undefined, store: StateStore): Params =>
  Object.fromEntries(Object.entries(params ?? {}).map(([key, value]) =>
    [key, isStateRef(value) ? store.get(value.state) : value]))
