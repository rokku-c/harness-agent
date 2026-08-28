import { memoryNotationStore, type NotationResolver, resolveNotation } from "../src/index.js"

/**
 * Test-fixture resolver: seeds a throwaway store and returns the resolver -
 * op descriptions are model-facing prose, so fixtures go through notation too.
 */
export const fixtureNotation = (
  entries: ReadonlyArray<{ readonly target: string; readonly instructions: ReadonlyArray<string> }>
): NotationResolver => {
  const store = memoryNotationStore(entries)
  return (target, vars) => resolveNotation(store, target, vars)
}
