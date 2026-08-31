/**
 * The prose rule: every model-facing text is notation - a branded string
 * resolved from a store. Definitions carry targets, not prose.
 */
declare const brand: unique symbol
export type NotationText = string & { readonly [brand]: true }

export interface NotationEntry {
  readonly target: string
  readonly instructions?: ReadonlyArray<string>
}

export interface NotationStore {
  readonly get: (target: string) => NotationEntry | undefined
}

export const memoryNotationStore = (entries: ReadonlyArray<NotationEntry>): NotationStore => {
  const map = new Map(entries.map((entry) => [entry.target, entry]))
  return { get: (target) => map.get(target) }
}

export const notationText = (value: string) => value as NotationText

export const resolveNotation = (store: NotationStore, target: string, vars?: Record<string, string>): NotationText => {
  const entry = store.get(target)
  if (entry === undefined) throw new Error('notation: unresolved target "' + target + '"')
  const interpolate = (text: string): string =>
    text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key: string) => {
      const value = vars?.[key]
      if (value === undefined) throw new Error('notation: target "' + target + '" requires variable "' + key + '"')
      return value
    })
  const text = (entry.instructions ?? []).map(interpolate).join("\n")
  if (text.length === 0) throw new Error('notation: target "' + target + '" resolves to empty text')
  return text as NotationText
}

