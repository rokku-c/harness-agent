import { z } from "zod"
import type { ConfigFailureReason } from "./errors.ts"

export type { ConfigFailureReason }

export interface ConfigDeclaration<S extends z.ZodType = z.ZodType> {
  readonly appId: string
  readonly title?: string
  readonly description?: string
  readonly schema: S
  readonly default?: unknown
}

export type ConfigSource = "default" | "yaml" | "override"

export interface ConfigLayerInput {
  readonly yaml?: unknown
  readonly override?: unknown
}

export interface ConfigSaveOptions {
  readonly unset?: readonly string[]
}

export interface ConfigOutcome {
  readonly ok: boolean
  readonly appId: string
  readonly value: unknown
  readonly sources: Readonly<Record<string, ConfigSource>>
  readonly revision?: number
  readonly error?: string
  readonly reason?: ConfigFailureReason
}

export const toJsonSchema = (schema: z.ZodType): unknown => z.toJSONSchema(schema)

export { mergeConfig } from "./merge.ts"
