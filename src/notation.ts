/**
 * Notation: the natural-language layer. All prose that reaches a model
 * (tool descriptions, system prompts, agent charters) lives in a versioned
 * store and is injected at run time - code references targets, never prose.
 */

declare const __notation: unique symbol

/** A text value that provably came from the notation resolver. */
export type NotationText = string & { readonly __notation: typeof __notation }

export interface NotationEntry {
  readonly target: string
  readonly instructions?: ReadonlyArray<string>
}

export interface NotationStore {
  readonly get: (target: string) => NotationEntry | undefined
  readonly upsert: (entry: NotationEntry) => void
}

export const memoryNotationStore = (
  initial: ReadonlyArray<NotationEntry> = []
): NotationStore => {
  const records = new Map<string, NotationEntry>(initial.map((entry) => [entry.target, entry]))
  return {
    get: (target) => records.get(target),
    upsert: (entry) => { records.set(entry.target, entry) }
  }
}

const interpolate = (template: string, vars: Record<string, unknown> | undefined): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (vars === undefined || !(name in vars))
      throw new Error(`notation: "${template.slice(0, 48)}" references {${name}} but no such variable was passed`)
    return String(vars[name])
  })

/** Resolve a target: instructions joined with newlines, {var} interpolated. */
export const resolveNotation = (
  store: NotationStore,
  target: string,
  vars?: Record<string, unknown>
): NotationText => {
  const entry = store.get(target)
  if (entry === undefined) throw new Error(`notation: no entry for target "${target}"`)
  const lines = entry.instructions ?? []
  if (lines.length === 0) throw new Error(`notation: entry "${target}" carries no instructions`)
  return lines.map((line) => interpolate(line, vars)).join("\n") as NotationText
}

export interface NotationResolver {
  (target: string, vars?: Record<string, unknown>): NotationText
}
