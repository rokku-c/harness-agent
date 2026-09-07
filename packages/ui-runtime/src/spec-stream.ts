import { applySpecPatch, parseSpecStreamLine, type JsonPatch, type Spec } from "@json-render/core"

export interface SpecStreamAdapter {
  apply(patch: JsonPatch): Spec
  applyLine(line: string): Spec | undefined
  snapshot(): Spec
}

export const makeSpecStreamAdapter = (initial: Spec, onPatch?: (patch: JsonPatch, spec: Spec) => void): SpecStreamAdapter => {
  let spec = structuredClone(initial)
  const apply = (patch: JsonPatch): Spec => {
    spec = structuredClone(applySpecPatch(spec, patch))
    onPatch?.(patch, structuredClone(spec))
    return structuredClone(spec)
  }
  return {
    apply,
    applyLine: (line) => {
      const patch = parseSpecStreamLine(line)
      return patch === null ? undefined : apply(patch)
    },
    snapshot: () => structuredClone(spec)
  }
}
