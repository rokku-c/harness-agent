/**
 * app-portable bundle entry — the artifact §7 is about.
 *
 * It touches no ambient API at all: no `Date.now()`, no `crypto`, no storage
 * import. Everything it needs arrives through the `capabilities` the loading
 * host injects, which is what lets the *same compiled bytes* run in an OS
 * process, a browser page and a sandbox and behave identically.
 *
 * `requires` in the manifest is the declaration that makes this checkable: a
 * host that cannot provide one of these refuses the artifact before a line of
 * this file executes.
 */

interface Clock { now(): number; after(ms: number): Promise<void> }
interface Store { get(key: string): unknown; set(key: string, value: unknown): void; list(prefix?: string): readonly string[] }
interface Crypto { randomUUID(): string; digest(algorithm: "SHA-256", data: string): Promise<string> }
interface Capabilities { readonly runtime: string; readonly clock?: Clock; readonly storage?: Store; readonly crypto?: Crypto }

export interface PortableApi {
  readonly namespace?: string
  readonly capabilities?: Capabilities
}

const need = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) throw new Error(`app-portable: no ${name} was injected`)
  return value
}

/** The marker `register` leaves in the host's store, whatever the runtime. */
export const REGISTERED = "app-portable/registered"

export const register = (api: PortableApi): (() => void) => {
  // Recorded before anything else, so a host that lets this file run at all
  // leaves a trace here. That is what makes the trace a real test of the
  // refusal gate: its whole job is to stop this line from being reached.
  api.capabilities?.storage?.set(REGISTERED, { runtime: api.capabilities.runtime })
  const app = makePortable(api)
  return () => { void app }
}

/** Exported so a host/test can exercise the artifact without a registry. */
export const makePortable = (api: PortableApi) => {
  const clock = need(api.capabilities?.clock, "clock")
  const storage = need(api.capabilities?.storage, "storage")
  const crypto = need(api.capabilities?.crypto, "crypto")
  const prefix = "stamps/"
  return {
    /** Record one entry, returning the same shape whatever the runtime. */
    async stamp(text: string) {
      const id = crypto.randomUUID()
      const at = clock.now()
      storage.set(prefix + id, { text, at, verified: id.startsWith("id-") })
      return { id, at, digest: await crypto.digest("SHA-256", text) }
    },
    history(): readonly unknown[] {
      return storage.list(prefix).map((key) => storage.get(key))
    },
    runtime: api.capabilities?.runtime,
  }
}
