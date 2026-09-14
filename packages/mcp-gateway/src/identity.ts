export type HeaderBag = Readonly<Record<string, string | string[] | undefined>> | Headers

export interface McpIdentity {
  readonly session?: string
  readonly requestId?: string
}

export interface McpAuthIdentity {
  readonly clientId: string
  readonly extra?: Readonly<Record<string, unknown>>
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value)
const strings = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined)

export const headerValue = (headers: HeaderBag, name: string): string | undefined => {
  const wanted = name.toLowerCase()
  if (headers instanceof Headers) return headers.get(wanted) ?? undefined
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return first(value)
  return undefined
}

export function identityFromRequest(input: {
  readonly headers?: HeaderBag
  readonly authInfo?: McpAuthIdentity
}): McpIdentity {
  const headers = input.headers ?? {}
  const extra = input.authInfo?.extra
  return {
    session: strings(extra?.sessionId) ?? headerValue(headers, "x-session-id"),
    requestId: strings(extra?.requestId) ?? headerValue(headers, "x-request-id"),
  }
}
