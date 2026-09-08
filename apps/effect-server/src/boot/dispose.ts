/** Best-effort cleanup of every owned resource, with observable failure. */
export const disposeAll = async (steps: ReadonlyArray<() => void | Promise<void>>): Promise<void> => {
  const errors: unknown[] = []
  for (const stop of steps) {
    try { await stop() } catch (error) { errors.push(error) }
  }
  if (errors.length) throw new AggregateError(errors, "effect-server shutdown failed")
}
