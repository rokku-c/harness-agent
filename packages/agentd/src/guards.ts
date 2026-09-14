import { AgentdError } from "./errors.ts"

export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const fail: (message: string) => never = (message) => { throw new AgentdError(400, message) }

export const sameKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")

export const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0
