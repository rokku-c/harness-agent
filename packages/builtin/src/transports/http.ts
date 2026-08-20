import { Effect, Schema } from "effect"
import { ConnectionError, RemoteSpec, makeConnection, type Connection, type RemoteRequest, type RemoteResponse } from "@effect-agent/core"

/**
 * HTTP 远程 Connection —— 把远程 REST API 暴露为 ops。
 *
 * 「一个 HTTP 请求 = 一个 op」：
 *   http.get  → GET {base}/{path}，返回 JSON 响应体
 *   http.post → POST {base}/{path} 带 JSON body，返回 JSON 响应体
 *
 * 通过通用构造路径 makeConnection + RemoteSpec 生成 Op / binding / container：
 *   const api = HttpConnection("https://api.example.com")
 *   const containers = yield* api.open
 *   container.bindings[0].ops  // [http.get, http.post]
 *
 * 也可以协议级直呼 api.request({ method: "http.get", params: { path: "/users" } })
 */
export interface HttpConnectionOptions {
  readonly headers?: Readonly<Record<string, string>>
}

export const HttpConnection = (
  baseUrl: string,
  options: HttpConnectionOptions = {}
): Connection => {
  const spec = [
    RemoteSpec.read({
      name: "http.get",
      description: `对 ${baseUrl} 发起 GET 请求，返回 JSON 响应体。path 相对于 baseUrl 拼接。`,
      input: Schema.Struct({ path: Schema.String }),
      output: Schema.Unknown
    }),
    RemoteSpec.write({
      name: "http.post",
      description: `对 ${baseUrl} 发起 POST 请求，body 以 JSON 发送，返回 JSON 响应体。path 相对于 baseUrl 拼接。`,
      input: Schema.Struct({ path: Schema.String, body: Schema.Unknown }),
      output: Schema.Unknown
    })
  ] as RemoteSpec<any, any>[]

  const request = (req: RemoteRequest): Effect.Effect<RemoteResponse, ConnectionError, never> => {
    const { method, params } = req
    const p = params as Readonly<Record<string, unknown>> | undefined
    const path = typeof p?.path === "string" ? p.path : ""
    const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
    const headers: Record<string, string> = { "content-type": "application/json", ...options.headers }
    const init: RequestInit = method === "http.post" ? { method: "POST", headers, body: JSON.stringify(p?.body) } : { method: "GET", headers }
    return Effect.tryPromise({
      try: () => fetch(url, init).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
        return res.json()
      }),
      catch: (cause) => new ConnectionError({ uri: baseUrl, cause })
    }).pipe(Effect.map((value): RemoteResponse => ({ value })))
  }

  return makeConnection({ uri: baseUrl, spec, request })
}
