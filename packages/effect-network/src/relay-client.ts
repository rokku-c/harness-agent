import { targetHeaders } from "./headers.ts"
import { targetURL } from "./request.ts"
import type { HttpSend, MainNode } from "./types.ts"

/** Node identity and upstream identity never occupy the same Authorization header. */
export const relayRequest = (appId: string, target: Request, main: MainNode, send: HttpSend): Promise<Response> => {
  const url = targetURL(main.url)
  url.pathname = "/-/network/egress"; url.search = ""
  const headers = new Headers({ authorization: `Bearer ${main.token}`, "x-effect-app": appId,
    "x-effect-target-url": target.url,
    "x-effect-target-headers": Buffer.from(JSON.stringify([...targetHeaders(target.headers)])).toString("base64"),
  })
  return send(new Request(url, { method: target.method, headers, redirect: "manual", signal: target.signal,
    ...(!["GET", "HEAD"].includes(target.method) ? { body: target.body } : {}),
  }))
}
