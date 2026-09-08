export type AsyncAppDisposer = () => Promise<void>
export type Cleanup = () => void | Promise<void>

/** All callers share completion (including failure); every cleanup runs in reverse. */
export const asyncDisposer = (steps: readonly Cleanup[]): AsyncAppDisposer => {
  let completion: Promise<void> | undefined
  return () => completion ??= Promise.resolve().then(async () => {
    const errors: unknown[] = []
    for (const step of [...steps].reverse()) {
      try { await step() } catch (error) { errors.push(error) }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length !== 0) throw new AggregateError(errors, "effect-apps: disposal failed")
  })
}

export const rollback = async (error: unknown, dispose: Cleanup): Promise<never> => {
  try { await dispose() } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], "effect-apps: registration and rollback failed")
  }
  throw error
}
