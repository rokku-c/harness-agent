import { z } from "zod"
import type { ConfigDeclaration, ConfigOutcome, ConfigSource } from "./contract.ts"
import { ConfigError, type ConfigFailureReason } from "./errors.ts"

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const failure = (appId: string, error: string, reason?: ConfigFailureReason): ConfigOutcome =>
  ({ ok: false, appId, value: {}, sources: {}, error, ...(reason === undefined ? {} : { reason }) })

/**
 * The registry's error boundary. A package-raised refusal keeps its reason, so a
 * caller can still tell "rebuild the store" apart from a fault; anything else
 * came from storage and has no instruction to pass on.
 */
export const storageFailure = (appId: string, error: unknown): ConfigOutcome =>
  error instanceof ConfigError ? failure(appId, error.message, error.reason)
    : failure(appId, "config storage operation failed")

/** Reject unknown top-level keys, even when an app uses Zod's default stripping object. */
export function validateConfig(
  decl: ConfigDeclaration,
  value: unknown,
  inputSources: Readonly<Record<string, ConfigSource>>,
): ConfigOutcome {
  if (!isRecord(value)) return failure(decl.appId, "config must be an object")
  const schema = decl.schema instanceof z.ZodObject ? decl.schema.strict() : decl.schema
  const parsed = schema.safeParse(value)
  if (!parsed.success) return failure(decl.appId, parsed.error.issues.map((issue) =>
    `${issue.path.join(".") || "(root)"}: invalid config (${issue.code})`).join("; "))
  const data = parsed.data
  if (!isRecord(data)) return failure(decl.appId, "config must resolve to an object")
  if (Object.keys(value).some((key) => !Object.hasOwn(data, key)))
    return failure(decl.appId, "config contains unsupported top-level keys")
  const sources = Object.fromEntries(Object.keys(data).map((key) =>
    [key, Object.hasOwn(inputSources, key) ? inputSources[key] : "default"]))
  return { ok: true, appId: decl.appId, value: data, sources }
}
