const hop = new Set(["host", "content-length", "connection", "keep-alive", "proxy-authorization", "proxy-authenticate",
  "transfer-encoding", "upgrade", "te", "trailer", "proxy-connection"])

export const headerPairs = (headers: Headers): ReadonlyArray<readonly [string, string]> => {
  const out: Array<readonly [string, string]> = []
  ;(headers as Headers & { forEach(cb: (value: string, key: string) => void): void }).forEach((value, key) => out.push([key, value]))
  return out
}

export const connectionHeaderNames = (headers: Headers): ReadonlySet<string> =>
  new Set((headers.get("connection") ?? "").split(",").map((s) => s.trim().toLowerCase()))

export const targetHeaders = (input: Headers): Headers => {
  const headers = new Headers(input)
  const named = connectionHeaderNames(headers)
  for (const key of headerPairs(headers).map(([name]) => name)) {
    if (hop.has(key) || named.has(key) || key.startsWith("x-effect-") || /^x-(agent|session|namespace|bundle)(-|$)/.test(key)) headers.delete(key)
  }
  return headers
}
