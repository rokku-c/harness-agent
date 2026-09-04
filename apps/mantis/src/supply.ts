/**
 * Tool supply - context economy (the mantis supply-side idea, distilled).
 *
 * Tools are tiered. The model starts on the "core" surface only and grows
 * it by explicitly enabling extended tools (discoverable -> active), so the
 * first context never floods with every granted op. The growth is model
 * driven (calling "enable" is an ordinary tool call) instead of a separate
 * capability-graph runtime - the planTools hook of the driver then exposes
 * exactly the visible surface on every step.
 */
export type Tier = "core" | "extended"

export interface SupplySpec {
  readonly tier: Tier
  /** blurb shown in the catalog */
  readonly description: string
}

/** the supply registry: op name -> spec */
export type SupplyRegistry = Readonly<Record<string, SupplySpec>>

/** Activation state: which ops the model may see right now. */
/** derive the tier registry from a capability manifest (the single source of truth) */
export const supplyFromCapabilities = (
  capabilities: ReadonlyArray<{ name: string; tier: Tier; description: string }>
): SupplyRegistry =>
  Object.fromEntries(capabilities.map((capability) => [capability.name, { tier: capability.tier, description: capability.description }]))

export class ToolSupply {
  readonly #specs: SupplyRegistry
  readonly #enabled = new Set<string>()
  constructor(specs: SupplyRegistry) {
    this.#specs = specs
  }
  /** op names visible on the next model call: core always + explicitly enabled */
  readonly visible = (): ReadonlyArray<string> =>
    Object.keys(this.#specs).filter((name) => {
      const spec = this.#specs[name]
      return spec !== undefined && (spec.tier === "core" || this.#enabled.has(name))
    })
  /** the discoverable surface: extended tools the model can ask to enable */
  readonly catalog = (): ReadonlyArray<{ name: string; description: string }> =>
    Object.entries(this.#specs)
      .filter(([, spec]) => spec.tier === "extended")
      .map(([name, spec]) => ({ name, description: spec.description }))
  /** extended tools currently enabled (ordered) - used to persist a session's surface */
  readonly enabledExtended = (): ReadonlyArray<string> => [...this.#enabled]
  /** activate an extended tool; returns an error message when it cannot be enabled */
  readonly enable = (name: string): string | undefined => {
    const spec = this.#specs[name]
    if (spec === undefined) return "unknown tool: " + name
    if (spec.tier === "core") return name + " is already core - no need to enable"
    this.#enabled.add(name)
    return undefined
  }
}
