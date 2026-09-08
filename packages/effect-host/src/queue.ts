/** Same-id operations serialize; different plugins may load/stop independently. */
export const makeLifecycleQueue = () => {
  const pending = new Map<string, Promise<unknown>>()
  let closing: Promise<void> | undefined

  const enqueue = <T>(id: string, operation: () => Promise<T>): Promise<T> => {
    const result = (pending.get(id) ?? Promise.resolve()).then(operation, operation)
    pending.set(id, result)
    const release = () => { if (pending.get(id) === result) pending.delete(id) }
    // Observe only for queue bookkeeping; the caller receives the original rejection.
    void result.then(release, release)
    return result
  }

  return {
    run<T>(id: string, operation: () => Promise<T>): Promise<T> {
      return closing === undefined ? enqueue(id, operation) : Promise.reject(new Error("effect-host: closed"))
    },
    close(ids: Iterable<string>, remove: (id: string) => Promise<unknown>): Promise<void> {
      if (closing !== undefined) return closing
      const keys = [...new Set([...ids, ...pending.keys()])]
      closing = Promise.resolve().then(async () => {
        const results = await Promise.allSettled(keys.map((id) => enqueue(id, () => remove(id))))
        const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
        if (errors.length === 1) throw errors[0]
        if (errors.length !== 0) throw new AggregateError(errors, "effect-host: close failed")
      })
      return closing
    },
  }
}
