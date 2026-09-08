/**
 * rewriteRequest — serve a backend that expects a root/absolute URL scheme
 * under a path prefix by rewriting the request path before dispatch.
 */

export const rewriteRequest = (
  request: Request,
  base: string,
): Request | undefined => {
  const url = new URL(request.url)
  const path = url.pathname
  if (path === base) {
    url.pathname = "/"
  } else if (path.startsWith(base + "/")) {
    url.pathname = path.slice(base.length)
  } else {
    return undefined
  }
  const init: RequestInit = { method: request.method, headers: request.headers }
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body
  return new Request(url.toString(), init)
}
