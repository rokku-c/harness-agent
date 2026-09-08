const hop = new Set(["host", "content-length", "connection", "keep-alive", "proxy-authorization", "proxy-authenticate",
  "transfer-encoding", "upgrade", "te", "trailer", "proxy-connection"])

/** Removes transport/platform metadata, never the target's own Authorization. */
export const targetHeaders = (input: Headers): Headers => {
  const headers = new Headers(input)
  const named = new Set((headers.get("connection") ?? "").split(",").map((s) => s.trim().toLowerCase()))
  for (const key of [...headers.keys()]) {
    if (hop.has(key) || named.has(key) || key.startsWith("x-effect-") || /^x-(agent|session|namespace|bundle)(-|$)/.test(key)) headers.delete(key)
  }
  return headers
}
