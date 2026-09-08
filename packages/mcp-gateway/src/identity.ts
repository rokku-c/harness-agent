/** Identity is trusted only from standard transport headers or validated auth. */
export type HeaderBag = Readonly<Record<string, string | string[] | undefined>> | Headers
export interface McpIdentity { readonly agent?: string; readonly session?: string; readonly requestId?: string }
export interface McpAuthIdentity { readonly clientId: string; readonly extra?: Readonly<Record<string, unknown>> }
const first = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value
const strings = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined

export function identityFromHeaders(headers: HeaderBag): McpIdentity {
  const values: Record<string, string | undefined> = {}
  if (headers instanceof Headers) headers.forEach((value, key) => { values[key.toLowerCase()] = value })
  else for (const [key, value] of Object.entries(headers)) values[key.toLowerCase()] = first(value)
  return { agent: values["x-agent-id"], session: values["x-session-id"], requestId: values["x-request-id"] }
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
