/**
 * effect-config contract — schema-declared configuration.
 *
 * Each app declares its configuration as one zod schema (same philosophy as
 * effect-interface: one zod = type + validator + exportable JSON Schema).
 * A declared config is layered: schema default  <-  effect.yaml `config:`
 * (partial)  <-  runtime override. Merge output records per-key provenance so
 * a Config App can show where every value came from.
 */

import { z } from "zod"

export interface ConfigDeclaration<S extends z.ZodType = z.ZodType> {
  /** the app/interface this config belongs to, e.g. "board". */
  readonly appId: string
  readonly title?: string
  readonly description?: string
  readonly schema: S
  /** whole-document default; when omitted an empty object is used. */
  readonly default?: unknown
}

export type ConfigSource = "default" | "yaml" | "override"

export interface ConfigLayerInput {
  readonly yaml?: unknown
  readonly override?: unknown
}

export interface ConfigSaveOptions {
  /** Top-level keys to remove after patching; conflicts with patch keys are rejected. */
  readonly unset?: readonly string[]
}

export interface ConfigOutcome {
  readonly ok: boolean
  readonly appId: string
  /** merged, validated value. */
  readonly value: unknown
  /** per top-level key: which layer provided it. */
  readonly sources: Readonly<Record<string, ConfigSource>>
  /** Absent for pure merges or failures without a persisted result. */
  readonly revision?: number
  readonly error?: string
}

export const toJsonSchema = (schema: z.ZodType): unknown => z.toJSONSchema(schema)

export { mergeConfig } from "./merge.ts"
