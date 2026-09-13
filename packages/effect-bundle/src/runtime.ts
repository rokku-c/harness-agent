/**
 * Runtime constructors — the other half of `capabilities.ts`.
 *
 * `capabilities.ts` is the vocabulary and the check: what a host may provide,
 * and whether it can provide what an artifact declared it needs. That half has
 * to be adjudicated *before* anything is loaded, so it is the loader's. This
 * half is the implementations: how an OS host builds a clock, and what a
 * sandbox host is handed. Nothing imports it to decide anything — only to run.
 *
 * The distinction the constructors encode is the one that decides whether
 * "runs in a sandbox" is a fact or a slogan:
 *
 *   ambient (os | browser) — there is a real clock and WebCrypto here, so they
 *              are handed over; storage defaults to this process's memory.
 *   sandbox  — **only what was injected**. A sandbox handed no clock has no
 *              clock, even though the process around it has one.
 *
 * Two constructors and not three: os and browser differ in what they can
 * provide, not in how the seam is built, and a third one differing only by
 * label would be decoration.
 */

import { makeNodeStore } from "@effect-agent/effect-planes"
import type { EffectRuntimeKind } from "./compat.ts"
import type { Clock, CryptoCapability, RuntimeCapabilities } from "./capabilities.ts"

/** Build a {@link Clock} from whichever timer primitive the *host* has. */
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

/** Build a {@link CryptoCapability} from a WebCrypto-shaped object. */
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

/**
 * An ambient host. Storage defaults to this process's memory — honest for os,
 * and a real limitation for browser, where it does not survive a page reload
 * (the IndexedDB backend is §7.5-5, not invented here). Inject a store for
 * durability.
 */
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

/**
 * A sandbox host. Nothing is ambient — not even the clock and crypto the
 * surrounding process obviously has, because those are exactly the ambient
 * powers a sandbox is defined by lacking. What is not passed in is not there.
 */
export const sandboxCapabilities = (
  injected: Partial<Omit<RuntimeCapabilities, "runtime">> = {},
): RuntimeCapabilities => ({ runtime: "sandbox", ...injected })
