import type { Spec } from "@json-render/core"
import type { ComponentRegistry, ComponentRenderer } from "@json-render/react"

const usedNames = (spec: Spec): string[] => {
  const names = new Set<string>()
  for (const element of Object.values(spec.elements ?? {})) {
    const type: unknown = element?.type
    if (typeof type === "string") names.add(type)
  }
  return [...names]
}

export const adaptRegistry = (spec: Spec, adapt: (name: string) => ComponentRenderer, ours?: ComponentRegistry): ComponentRegistry =>
  Object.fromEntries(usedNames(spec).map((name): [string, ComponentRenderer] => [name, ours?.[name] ?? adapt(name)]))
