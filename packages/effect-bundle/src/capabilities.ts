/**
 * Runtime capabilities — the host side of §7.2's "reach the world only through
 * injected capabilities" (docs/architecture-rework.md §7).
 *
 * This file is the *vocabulary and the check*: what a host may provide, and
 * whether it can provide what an artifact declared it needs. It lives beside
 * `compat.ts` because it is the same kind of thing — one adjudication over
 * declarations, computed before anything is loaded, with a verdict the loader
 * can act on. The *implementations* (an OS clock, a sandbox with only what was
 * injected) are `runtime.ts`, beside this file, which nothing imports to decide
 * anything.
 *
 * Every field is optional on purpose: the honest model is "a host may lack any
 * of these". `sandbox` in particular is defined by lacking ambient power, so a
 * type that assumed a clock would be lying about the runtime it is meant to
 * describe (§7.4: no uniform sandbox grade).
 */

import type { NodeStore } from "./store.ts"
import type { EgressRouter } from "@effect-agent/effect-network"
import type { EffectRuntimeKind } from "./compat.ts"

/** The capability vocabulary. One word per thing an app may be handed. */
export const CAPABILITY_NAMES = ["clock", "storage", "crypto", "network"] as const
export type CapabilityName = (typeof CAPABILITY_NAMES)[number]

/** Time, as an injected capability — never `Date.now()` read ambiently. */
export interface Clock {
  now(): number
  /** Resolve after `ms`. The only timer an app gets; there is no bare `setInterval`. */
  after(ms: number): Promise<void>
}

/** Randomness and hashing, as an injected capability. */
export interface CryptoCapability {
  randomUUID(): string
  /** Lowercase hex of the digest. */
  digest(algorithm: "SHA-256", data: string): Promise<string>
}

/**
 * What a host provides. Every field is optional on purpose: the honest model is
 * "a host may lack any of these", and the type should not pretend otherwise.
 * Use {@link requireCapability} to get a non-optional one or fail loudly.
 */
export interface RuntimeCapabilities {
  readonly runtime: EffectRuntimeKind
  readonly clock?: Clock
  readonly storage?: NodeStore
  readonly crypto?: CryptoCapability
  /** Egress, when the host has a network at all. A sandbox may have none. */
  readonly network?: EgressRouter
}

/** The capabilities actually present — the list a host may honestly claim. */
export const capabilitiesOf = (capabilities: RuntimeCapabilities): readonly CapabilityName[] =>
  CAPABILITY_NAMES.filter((name) => capabilities[name] !== undefined)

/** One-line honest summary — for logs, receipts and `/-/` surfaces. */
export const describeCapabilities = (capabilities: RuntimeCapabilities): string => {
  const present = capabilitiesOf(capabilities)
  return `${capabilities.runtime}: [${present.length === 0 ? "(nothing injected)" : present.join(", ")}]`
}

/**
 * A capability the caller needs, or a throw naming what is missing.
 *
 * Deliberately not a fallback: substituting a default store or a system clock
 * for a missing capability is how "runs in a sandbox" turns out to be a claim
 * nobody checked.
 */
export const requireCapability = <K extends CapabilityName>(
  capabilities: RuntimeCapabilities,
  name: K,
): NonNullable<RuntimeCapabilities[K]> => {
  const value = capabilities[name]
  if (value === undefined) {
    throw new Error(`effect-bundle: this host (${capabilities.runtime}) provides no "${name}"`)
  }
  return value as NonNullable<RuntimeCapabilities[K]>
}

/**
 * Which of `required` this host cannot provide.
 *
 * This is the check §7.4 asks for, expressed where the artifact *declares* its
 * needs (a bundle manifest's `requires`) rather than inferred from its code —
 * a declaration nobody made is not a declaration.
 */
export const capabilityGaps = (
  required: readonly string[],
  capabilities: RuntimeCapabilities,
): readonly string[] => {
  const known = new Set<string>(CAPABILITY_NAMES)
  return required.filter((name) => !known.has(name) || capabilities[name as CapabilityName] === undefined)
}
