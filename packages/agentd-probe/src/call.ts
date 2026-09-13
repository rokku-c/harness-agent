import { ProbeFault } from "./errors.ts"

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface CallOptions {
  readonly baseUrl: string
  readonly token?: string
  readonly fetch?: FetchLike
}

/**
 * How a status becomes a fault. Each route family reads the same 4xx
 * differently — a 404 on a node is a lapsed lease, a 404 on an artifact is a
 * version that has no bytes, a 404 on an intent is an unknown intent — so the
 * default is passed in by the caller rather than guessed at here.
 */
export type Refuse = (status: number, detail: string, where: string) => ProbeFault

/** The default reading, and the right one wherever a 4xx is about *this caller*. */
export const byStatus = (status: number, detail: string, where: string): ProbeFault =>
  status === 404 ? new ProbeFault("lapsed", `${where}: ${detail}`, status)
  : status === 409 ? new ProbeFault("stale", `${where}: ${detail}`, status)
  : status >= 500 ? new ProbeFault("unavailable", `${where}: ${detail}`, status)
  : new ProbeFault("refused", `${where}: ${detail}`, status)

export interface Caller {
  readonly call: (method: "GET" | "POST", path: string, body: unknown, refuse?: Refuse) => Promise<Record<string, unknown>>
}

/**
 * Every verb in this package goes out through here, because the interesting
 * part is not the request but the four ways it can end, and a second copy of
 * this would be a second set of answers to them.
 */
export const makeCaller = (options: CallOptions): Caller => {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  return {
    call: async (method, path, body, refuse = byStatus) => {
      const where = `${method} ${path}`
      let response: Response
      try {
        response = await doFetch(`${options.baseUrl}${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      } catch (error) {
        // No response at all is not one of the answers — it is the absence of one,
        // and the one case a caller is most tempted to mistake for "nothing wrong".
        throw new ProbeFault("unreachable", `${where}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const payload = await response.json().catch(() => undefined) as { ok?: boolean; error?: string } | undefined
      if (response.ok && payload?.ok === true) return payload as Record<string, unknown>
      throw refuse(response.status, payload?.error ?? response.statusText, where)
    },
  }
}
