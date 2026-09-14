export type Tier = "core" | "extended"

export interface SupplySpec {
  readonly tier: Tier
  readonly description: string
}

export type SupplyRegistry = Readonly<Record<string, SupplySpec>>

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
  readonly visible = (): ReadonlyArray<string> =>
    Object.keys(this.#specs).filter((name) => {
      const spec = this.#specs[name]
      return spec !== undefined && (spec.tier === "core" || this.#enabled.has(name))
    })
  readonly catalog = (): ReadonlyArray<{ name: string; description: string }> =>
    Object.entries(this.#specs)
      .filter(([, spec]) => spec.tier === "extended")
      .map(([name, spec]) => ({ name, description: spec.description }))
  readonly enabledExtended = (): ReadonlyArray<string> => [...this.#enabled]
  readonly enable = (name: string): string | undefined => {
    const spec = this.#specs[name]
    if (spec === undefined) return "unknown tool: " + name
    if (spec.tier === "core") return name + " is already core - no need to enable"
    this.#enabled.add(name)
    return undefined
  }
}
