import { OperationFault } from "@effect-agent/effect-interface"
import { refusalOf, type HerdrError } from "./herdr-refusal.ts"

export interface HerdrClient {
  readonly call: (method: string, params?: Readonly<Record<string, unknown>>, timeoutMs?: number) => Promise<unknown>
}

export interface HerdrClientOptions {
  readonly socketPath: string
  readonly timeoutMs?: number
}

const unwrap = (raw: string): unknown => {
  const envelope = JSON.parse(raw) as { result?: unknown; error?: HerdrError }
  if (envelope.error === undefined) return envelope.result
  throw refusalOf(envelope.error)
}

let seq = 0

const once = (options: HerdrClientOptions, method: string, params: Readonly<Record<string, unknown>>, overrideMs?: number): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const timeoutMs = overrideMs ?? options.timeoutMs ?? 10_000
    const id = `h${++seq}`
    const request = JSON.stringify({ id, method, params }) + "\n"
    let buffer = ""
    let settled = false
    let live: { end(): void } | undefined
    const finish = (run: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { live?.end() } catch { /* the socket is already gone; the answer still stands */ }
      run()
    }
    const timer = setTimeout(
      () => finish(() => reject(new OperationFault(504, `herdr did not answer ${method} within ${timeoutMs}ms`))),
      timeoutMs,
    )
    void Bun.connect({
      unix: options.socketPath,
      socket: {
        open: (socket) => { live = socket; socket.write(request) },
        data: (_socket, chunk) => {
          buffer += chunk.toString()
          const end = buffer.indexOf("\n")
          if (end === -1) return
          const line = buffer.slice(0, end)
          finish(() => { try { resolve(unwrap(line)) } catch (error) { reject(error) } })
        },
        error: (_socket, error) => finish(() => reject(new OperationFault(502, error.message))),
        close: () => finish(() => reject(new OperationFault(502, `herdr closed the socket before answering ${method}`))),
      },
    }).catch((error: Error) => finish(() => reject(new OperationFault(502, `herdr socket ${options.socketPath}: ${error.message}`))))
  })

export const makeHerdrClient = (options: HerdrClientOptions): HerdrClient => ({
  call: (method, params = {}, timeoutMs) => once(options, method, params, timeoutMs),
})
