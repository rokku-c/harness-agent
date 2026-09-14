import type { NodeStore } from "./store.ts"
import type { EgressRouter } from "@effect-agent/effect-network"
import type { EffectRuntimeKind } from "./compat.ts"

export const CAPABILITY_NAMES = ["clock", "storage", "crypto", "network"] as const
export type CapabilityName = (typeof CAPABILITY_NAMES)[number]

export interface Clock {
  now(): number
  after(ms: number): Promise<void>
}

export interface CryptoCapability {
  randomUUID(): string
  digest(algorithm: "SHA-256", data: string): Promise<string>
}

export interface RuntimeCapabilities {
  readonly runtime: EffectRuntimeKind
  readonly clock?: Clock
  readonly storage?: NodeStore
  readonly crypto?: CryptoCapability
  readonly network?: EgressRouter
}

export const capabilitiesOf = (capabilities: RuntimeCapabilities): readonly CapabilityName[] =>
  CAPABILITY_NAMES.filter((name) => capabilities[name] !== undefined)

export const describeCapabilities = (capabilities: RuntimeCapabilities): string => {
  const present = capabilitiesOf(capabilities)
  return `${capabilities.runtime}: [${present.length === 0 ? "(nothing injected)" : present.join(", ")}]`
}

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

export const capabilityGaps = (
  required: readonly string[],
  capabilities: RuntimeCapabilities,
): readonly string[] => {
  const known = new Set<string>(CAPABILITY_NAMES)
  return required.filter((name) => !known.has(name) || capabilities[name as CapabilityName] === undefined)
}
