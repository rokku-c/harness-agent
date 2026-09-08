import type { z } from "zod"
import type { ConfigDeclaration, ConfigLayerInput, ConfigOutcome, ConfigSource } from "./contract.ts"
import { failure, isRecord, validateConfig } from "./validation.ts"

/** Pure first-import layering: defaults < YAML < explicit override. */
export function mergeConfig<S extends z.ZodType>(
  decl: ConfigDeclaration<S>,
  layers: ConfigLayerInput = {},
): ConfigOutcome {
  const inputs = [decl.default, layers.yaml, layers.override]
  if (inputs.some((input) => input !== undefined && !isRecord(input)))
    return failure(decl.appId, "config layers must be objects")
  const defaults = isRecord(decl.default) ? decl.default : {}
  const yaml = isRecord(layers.yaml) ? layers.yaml : {}
  const override = isRecord(layers.override) ? layers.override : {}
  const value = { ...defaults, ...yaml, ...override }
  const sources: Record<string, ConfigSource> = Object.fromEntries(
    Object.keys(value).map((key) => [key, Object.hasOwn(override, key) ? "override"
      : Object.hasOwn(yaml, key) ? "yaml" : "default"]),
  )
  return validateConfig(decl, value, sources)
}
