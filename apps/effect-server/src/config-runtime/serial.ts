/** Serialize activation per app, while unrelated apps may apply concurrently. */
export const keyedSerial = () => {
  const tails = new Map<string, Promise<unknown>>()
  return <T>(key: string, action: () => Promise<T>): Promise<T> => {
    const next = (tails.get(key) ?? Promise.resolve()).catch(() => {}).then(action)
    tails.set(key, next)
    void next.finally(() => { if (tails.get(key) === next) tails.delete(key) }).catch(() => {})
    return next
  }
}
