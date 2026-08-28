import type { AgentContext } from "./core.js"

/**
 * Agent-definition notation: the natural-language text that reaches a model
 * (prompts, role charters, instruction scaffolding) lives in a versioned
 * notation store and is injected at run time - agent definitions reference
 * targets, they never embed prose. This is the same discipline the
 * connection-level notation adapter applies to capability annotations,
 * applied to agent definitions.
 *
 * The text constructor is type-restricted: AgentContext.text accepts only
 * NotationText, which the resolver produces - a raw string literal fails to
 * compile. AgentContext.raw is the mechanical escape for non-prose fixtures
 * (tests, protocol scaffolding) and is named to make the deviation visible
 * in review.
 */

declare const __notation: unique symbol

/** A text value that provably came from the notation resolver. */
export type NotationText = string & { readonly __notation: typeof __notation }

/** Structural twin of the connection-level notation store (get/history/upsert). */
export interface NotationStore {
  readonly get: (target: string) =>
    | { readonly target: string; readonly instructions?: ReadonlyArray<string>; readonly version: number }
    | undefined
  readonly history: (target: string) => ReadonlyArray<unknown>
  readonly upsert: (entry: { readonly target: string; readonly instructions?: ReadonlyArray<string> }) => unknown
}

/** Minimal store for definitions and examples; the connection-level
 * notation adapter implements the same shape for capability annotations. */
export const memoryNotationStore = (
  initial: ReadonlyArray<{ readonly target: string; readonly instructions?: ReadonlyArray<string> }> = []
): NotationStore => {
  const records = new Map<string, ReadonlyArray<{ readonly target: string; readonly instructions?: ReadonlyArray<string> }>>()
  for (const entry of initial) records.set(entry.target, [entry])
  return {
    get: (target) => {
      const versions = records.get(target)
      const latest = versions?.at(-1)
      return latest === undefined ? undefined : { ...latest, version: versions!.length }
    },
    history: (target) => records.get(target) ?? [],
    upsert: (entry) => {
      const versions = records.get(entry.target) ?? []
      records.set(entry.target, [...versions, entry])
      return entry
    }
  }
}

const interpolate = (template: string, vars: Readonly<Record<string, unknown>> | undefined): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (vars === undefined || !(name in vars))
      throw new Error(
        `notation: template "${template.slice(0, 60)}" references {${name}} but the caller passed no such variable - definition bug, fail loud`
      )
    return String(vars[name])
  })

/**
 * Resolve a notation target against the store: the entry's instructions are
 * joined with newlines and `{var}` placeholders are interpolated from vars.
 * A missing target or a referenced-but-unpassed variable throws - a
 * definition bug is a defect, not an expected error.
 */
export const resolveNotation = (
  store: NotationStore,
  target: string,
  vars?: Readonly<Record<string, unknown>>
): NotationText => {
  const entry = store.get(target)
  if (entry === undefined)
    throw new Error(`notation: no entry for target "${target}" - seed the store or fix the reference`)
  const lines = entry.instructions ?? []
  if (lines.length === 0)
    throw new Error(`notation: entry "${target}" carries no instructions - nothing to inject`)
  return lines.map((line) => interpolate(line, vars)).join("\n") as NotationText
}

/**
 * The resolver handed to definition input functions: `nl(target, vars)`
 * returns notation-injected text. Constructed only by `withNotation` - the
 * branded NotationText it returns cannot be produced outside the resolver.
 */
export interface NotationResolver {
  (target: string, vars?: Readonly<Record<string, unknown>>): NotationText
}

/**
 * Bind a notation store to a definition input function: the function receives
 * `(input, nl)` where nl resolves targets against this store. Agent.define's
 * signature is unchanged - the store rides the definition's closure.
 */
export const withNotation =
  <I>(store: NotationStore, build: (input: I, nl: NotationResolver) => AgentContext) =>
  (input: I): AgentContext =>
    build(input, (target, vars) => resolveNotation(store, target, vars))
