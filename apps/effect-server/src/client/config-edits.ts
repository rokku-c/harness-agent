/** Only a successful read advances the baseline; failed saves remain retryable. */
export function createConfigEdits() {
  let initialKeys: string[] = []
  return {
    loaded: (value: Readonly<Record<string, unknown>>) => { initialKeys = Object.keys(value) },
    patch: (override: Record<string, unknown>) => ({
      override,
      unset: initialKeys.filter(key => !Object.hasOwn(override, key)),
    }),
  }
}
