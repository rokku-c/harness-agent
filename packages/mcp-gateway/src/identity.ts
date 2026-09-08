/** Identity is trusted only from standard transport headers. */
export type HeaderBag = Readonly<Record<string, string | string[] | undefined>> | Headers
export interface McpIdentity { readonly agent?: string; readonly session?: string; readonly requestId?: string }
const first = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value
export function identityFromHeaders(headers: HeaderBag): McpIdentity {
  const values: Record<string, string | undefined> = {}
  if (headers instanceof Headers) headers.forEach((value, key) => { values[key.toLowerCase()] = value })
  else for (const [key, value] of Object.entries(headers)) values[key.toLowerCase()] = first(value)
  return { agent: values["x-agent-id"], session: values["x-session-id"], requestId: values["x-request-id"] }
}
