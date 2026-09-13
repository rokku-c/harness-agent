/**
 * mcp-gateway — what a request carries besides its credential.
 *
 * A caller's identity is decided in one place: the transport verified a
 * credential, and handed the result to the tool handlers as `authInfo`. What is
 * left for this file is *correlation* — a session and a request id, so a call
 * in the audit log can be matched with the line that produced it.
 *
 * Those are hints, and a hint is never an identity: anyone who can reach the
 * port writes them. A field the caller controls must not be able to decide who
 * the caller is, so there is no such field here to read.
 */
export type HeaderBag = Readonly<Record<string, string | string[] | undefined>> | Headers

export interface McpIdentity {
  readonly session?: string
  readonly requestId?: string
}

/** Claims the transport already parsed and verified; trusted by construction. */
export interface McpAuthIdentity {
  readonly clientId: string
  readonly extra?: Readonly<Record<string, unknown>>
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value)
const strings = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined)

/** Lower-cased header lookup — the one normalization every header reader shares. */
export const headerValue = (headers: HeaderBag, name: string): string | undefined => {
  const wanted = name.toLowerCase()
  if (headers instanceof Headers) return headers.get(wanted) ?? undefined
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return first(value)
  return undefined
}

/**
 * The correlation a request carries: what the verified claim bag says first,
 * and the request's own hints after it. Both are labels on a record, never an
 * input to a decision — `resolvePrincipal` never reads them either.
 */
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
