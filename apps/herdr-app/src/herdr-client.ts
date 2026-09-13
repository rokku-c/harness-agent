/**
 * Herdr's socket API, as a client.
 *
 * The wire is one JSON request per line and one JSON answer per line, both
 * carrying the same `id`, over a unix socket the running server owns. A
 * connection is opened per call: herdr answers on the connection the request
 * arrived on and the exchange is over, so holding one open would only be a
 * second thing to keep alive for no gain.
 *
 * An answer is either `{id, result}` or `{id, error}`. The error is herdr's
 * verdict about the request — an unknown method, a field it will not accept — so
 * it leaves here as a refusal carrying herdr's own code and a status, rather
 * than flattened into a string the caller can no longer tell apart from a
 * timeout.
 */
import { OperationFault } from "@effect-agent/effect-interface"
import { refusalOf, type HerdrError } from "./herdr-refusal.ts"

export interface HerdrClient {
  /**
   * One call. Throws a fault carrying herdr's own code when it refuses.
   *
   * `timeoutMs` overrides the configured one for this call only. A wait is the
   * one method whose duration is the caller's own choice, and a caller who asked
   * to be held for a minute cannot be answered by a client that gives up after
   * ten seconds — it would report its own deadline as herdr's silence.
   */
  readonly call: (method: string, params?: Readonly<Record<string, unknown>>, timeoutMs?: number) => Promise<unknown>
}

export interface HerdrClientOptions {
  readonly socketPath: string
  /** How long one call may take before it is this client's failure, not herdr's. */
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
          // The first line is the answer, and it is matched against nothing.
          // Herdr answers a request it could not parse with `"id": ""`, so
          // waiting for our own id back would turn its clear refusal into this
          // client's timeout — the one failure shape that says nothing about
          // what was wrong with the request.
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
