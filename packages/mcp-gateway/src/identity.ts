/** Identity is trusted only from standard transport headers or validated auth. */
export type HeaderBag = Readonly<Record<string, string | string[] | undefined>> | Headers
export interface McpIdentity { readonly agent?: string; readonly session?: string; readonly requestId?: string }
export interface McpAuthIdentity { readonly clientId: string; readonly extra?: Readonly<Record<string, unknown>> }
const first = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value
const strings = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined

/** Lower-cased header lookup — the one normalization every header reader shares. */
export const headerValue = (headers: HeaderBag, name: string): string | undefined => {
  const wanted = name.toLowerCase()
  if (headers instanceof Headers) return headers.get(wanted) ?? undefined
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return first(value)
  return undefined
}

export function identityFromHeaders(headers: HeaderBag): McpIdentity {
  return {
    agent: headerValue(headers, "x-agent-id"),
    session: headerValue(headers, "x-session-id"),
    requestId: headerValue(headers, "x-request-id"),
  }
}

export function identityFromRequest(input: { readonly headers?: HeaderBag; readonly authInfo?: McpAuthIdentity }): McpIdentity {
  const headers = identityFromHeaders(input.headers ?? {})
  const extra = input.authInfo?.extra
  return {
    agent: strings(extra?.agentId) ?? strings(input.authInfo?.clientId) ?? headers.agent,
    session: strings(extra?.sessionId) ?? headers.session,
    requestId: strings(extra?.requestId) ?? headers.requestId,
  }
}
