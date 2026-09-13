/**
 * Reading a declaration that arrived as `unknown`.
 *
 * The node and bundle config loaders both take an untrusted record and have to
 * get a typed value out of it, so both need the same four steps: is this an
 * object at all, is this field a non-empty string, does the record carry exactly
 * the keys the shape declares, and how does a refusal read. They were written
 * out in both files; this is the one copy, so a stricter check applies to both
 * rather than to whichever one was edited.
 */

import { AgentdError } from "./errors.ts"

/** An object, but not an array and not null — what a JSON record is. */
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Refuse with the loader's own status, so both loaders fail alike. */
export const fail: (message: string) => never = (message) => { throw new AgentdError(400, message) }

/** Exactly these keys, in any order — a shape, not a subset. */
export const sameKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")

/** A string with something in it; an empty id is a missing one. */
export const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0
