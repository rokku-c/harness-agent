import { makeNodeStore } from "./store.ts"
import type { EffectRuntimeKind } from "./compat.ts"
import type { Clock, CryptoCapability, RuntimeCapabilities } from "./capabilities.ts"

export const makeClock = (
  env: { now?: () => number; setTimeout?: (handler: () => void, ms: number) => unknown } = globalThis,
): Clock => {
  const now = env.now ?? Date.now
  const schedule = env.setTimeout
  return {
    now,
    after: (ms) => schedule === undefined
      ? Promise.reject(new Error("effect-bundle: no timer is available to this host"))
      : new Promise<void>((resolve) => { schedule(() => resolve(), ms) }),
  }
}

export const makeCrypto = (webcrypto: Crypto | undefined = globalThis.crypto): CryptoCapability => {
  if (webcrypto === undefined) throw new Error("effect-bundle: no WebCrypto is available to this host")
  return {
    randomUUID: () => webcrypto.randomUUID(),
    digest: async (algorithm, data) => {
      const bytes = await webcrypto.subtle.digest(algorithm, new TextEncoder().encode(data))
      return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    },
  }
}

export const ambientCapabilities = (
  runtime: Extract<EffectRuntimeKind, "os" | "browser">,
  overrides: Partial<Omit<RuntimeCapabilities, "runtime">> = {},
): RuntimeCapabilities => ({
  runtime,
  clock: makeClock(),
  crypto: makeCrypto(),
  storage: makeNodeStore(),
  ...overrides,
})

export const sandboxCapabilities = (
  injected: Partial<Omit<RuntimeCapabilities, "runtime">> = {},
): RuntimeCapabilities => ({ runtime: "sandbox", ...injected })
