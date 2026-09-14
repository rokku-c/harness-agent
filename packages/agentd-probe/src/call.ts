import { ProbeFault } from "./errors.ts"

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface CallOptions {
  readonly baseUrl: string
  readonly token?: string
  readonly fetch?: FetchLike
}

export type Refuse = (status: number, detail: string, where: string) => ProbeFault

export const byStatus = (status: number, detail: string, where: string): ProbeFault =>
  status === 404 ? new ProbeFault("lapsed", `${where}: ${detail}`, status)
  : status === 409 ? new ProbeFault("stale", `${where}: ${detail}`, status)
  : status >= 500 ? new ProbeFault("unavailable", `${where}: ${detail}`, status)
  : new ProbeFault("refused", `${where}: ${detail}`, status)

export interface Caller {
  readonly call: (method: "GET" | "POST", path: string, body: unknown, refuse?: Refuse) => Promise<Record<string, unknown>>
}

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
        throw new ProbeFault("unreachable", `${where}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const payload = await response.json().catch(() => undefined) as { ok?: boolean; error?: string } | undefined
      if (response.ok && payload?.ok === true) return payload as Record<string, unknown>
      throw refuse(response.status, payload?.error ?? response.statusText, where)
    },
  }
}
